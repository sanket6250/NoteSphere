#!/usr/bin/env python3
"""Copy legacy S3-compatible attachment objects into NoteSphere's PostgreSQL BYTEA table."""

import argparse
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from urllib.parse import unquote_plus, urlsplit

import boto3
import psycopg

MAX_FILE_BYTES = 25 * 1024 * 1024
REFERENCE = re.compile(
    r"/api/attachments/([0-9a-f-]{36})\?key=([^&\"'<>\s]+)", re.IGNORECASE
)


def safe_name(value):
    name = re.sub(r'[\\/\x00-\x1f\x7f"]', "_", value).strip()
    return (name or "attachment")[:255]


def file_metadata(key):
    attachment_id, separator, filename = key.partition("/")
    if not separator or not filename or "/" in filename or "\\" in filename:
        raise ValueError(f"Unexpected object key layout: {key!r}")
    return str(uuid.UUID(attachment_id)), safe_name(filename)


def required(name):
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"Set {name} before running the migration.")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write the verified objects and note relationships to PostgreSQL",
    )
    args = parser.parse_args()

    endpoint = required("STORAGE_ENDPOINT")
    bucket = required("S3_BUCKET")
    access_key = required("S3_ACCESS_KEY")
    secret_key = required("S3_SECRET_KEY")
    database_url = required("SPRING_DATASOURCE_URL")
    if database_url.startswith("jdbc:"):
        database_url = database_url[5:]
    database = urlsplit(database_url)
    if database.scheme != "postgresql":
        raise ValueError("SPRING_DATASOURCE_URL must be a PostgreSQL JDBC URL.")
    database_options = {
        "host": database.hostname,
        "port": database.port or 5432,
        "dbname": database.path.lstrip("/"),
        "user": required("SPRING_DATASOURCE_USERNAME"),
        "password": required("SPRING_DATASOURCE_PASSWORD"),
    }

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
    )

    objects = {}
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for item in page.get("Contents", []):
            attachment_id, filename = file_metadata(item["Key"])
            if item["Size"] > MAX_FILE_BYTES:
                raise ValueError(f"Object {attachment_id} exceeds the 25 MB file limit.")
            if attachment_id in objects:
                raise ValueError(f"Multiple legacy objects use attachment ID {attachment_id}.")
            objects[attachment_id] = (item["Key"], filename, item["Size"], item["LastModified"])

    note_links = {}
    with psycopg.connect(**database_options) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, content FROM notes")
            for note_id, content in cursor.fetchall():
                for match in REFERENCE.finditer(content or ""):
                    attachment_id = str(uuid.UUID(match.group(1)))
                    key = unquote_plus(match.group(2))
                    previous = note_links.get(attachment_id)
                    if previous is not None and previous[0] != key:
                        raise ValueError(f"Note content contains conflicting object keys for {attachment_id}.")
                    note_links.setdefault(attachment_id, (key, set()))[1].add(note_id)

            for attachment_id, (key, _) in note_links.items():
                if attachment_id not in objects or objects[attachment_id][0] != key:
                    raise ValueError(f"Referenced object {attachment_id} ({key}) is missing from the bucket.")

            print(f"Verified {len(objects)} bucket object(s) and {len(note_links)} referenced attachment(s).")
            if not args.apply:
                print("Dry run only. Rerun with --apply to write the BYTEA rows; no source objects are changed.")
                return 0

            migrated = 0
            linked = 0
            for attachment_id, (key, filename, expected_size, modified_at) in objects.items():
                response = s3.get_object(Bucket=bucket, Key=key)
                data = response["Body"].read(MAX_FILE_BYTES + 1)
                response["Body"].close()
                if len(data) != expected_size or len(data) > MAX_FILE_BYTES:
                    raise ValueError(f"Object size verification failed for {attachment_id}.")
                content_type = response.get("ContentType") or "application/octet-stream"
                now = modified_at or datetime.now(timezone.utc)
                with connection.transaction():
                    cursor.execute(
                        "SELECT file_name, original_file_name, content_type, file_size, file_data "
                        "FROM attachments WHERE id = %s",
                        (attachment_id,),
                    )
                    existing = cursor.fetchone()
                    if existing is None:
                        extension = filename.rsplit(".", 1)[1].lower() if "." in filename else None
                        cursor.execute(
                            """
                            INSERT INTO attachments
                              (id, file_name, original_file_name, content_type, file_size,
                               file_extension, file_data, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                attachment_id, filename, filename, content_type, len(data),
                                extension[:32] if extension else None, data, now, now,
                            ),
                        )
                        migrated += 1
                    elif existing != (filename, filename, content_type, len(data), data):
                        raise ValueError(f"Database attachment {attachment_id} differs from its source object.")

                    for note_id in note_links.get(attachment_id, (None, set()))[1]:
                        cursor.execute(
                            "INSERT INTO note_attachments(note_id, attachment_id) VALUES (%s, %s) "
                            "ON CONFLICT DO NOTHING",
                            (note_id, attachment_id),
                        )
                        linked += cursor.rowcount

            print(f"Imported {migrated} new file(s) and added {linked} note relationship(s).")
            print("Source bucket objects were not modified or deleted.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Migration stopped: {error}", file=sys.stderr)
        raise SystemExit(1)
