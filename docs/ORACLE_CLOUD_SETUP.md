# Oracle Cloud Always Free setup

This guide prepares one Ubuntu VM for NoteSphere and Coolify. It does not create resources. Oracle capacity, pricing and eligibility are controlled by Oracle and can change. Check the Console's **Always Free Eligible** label and the current [Always Free resource limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) before confirming each resource.

## 1. Create and verify an OCI account

1. Sign up through [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/). Use accurate identity and billing details. Oracle may require a supported credit/debit card for identity verification and may place a temporary authorization hold.
2. Select a home region close to you and your users. Always Free compute and block-volume allowances are tied to the home region; changing the home region later is not a simple migration.
3. The introductory US$300 trial credit is temporary and is not the Always Free allowance. After the trial, an account that has not upgraded remains limited to Always Free services and quotas. Do not upgrade to Pay As You Go if a hard no-charge policy is required.
4. If Oracle reports insufficient capacity for A1, wait or try another availability domain in the home region. Do not accept a paid shape as a workaround.

## 2. Create the VM

In the OCI Console, open **Compute → Instances → Create instance**:

1. Choose an Ubuntu LTS image marked Always Free eligible. For A1, select the ARM64 image.
2. Select **VM.Standard.A1.Flex** and allocate at most **2 OCPUs and 12 GB memory total**. The official Always Free allowance is 1,500 OCPU-hours and 9,000 GB-hours per month, equivalent to 2 OCPUs and 12 GB continuously for a typical month.
3. Use a 50 GB boot volume initially. The 200 GB Always Free block-volume allowance is combined across boot and attached volumes; the boot disk counts toward it. Leave headroom for Coolify, images, PostgreSQL, attachments, logs and backups.
4. Add your SSH public key at instance creation. Save the private key securely on your own computer.
5. A public subnet and an instance public IP are needed for direct public HTTP/DNS operation. Do not create a load balancer or NAT gateway for this single-VM design.
6. Confirm the final resource summary says Always Free eligible before selecting **Create**. This confirmation is a manual action; this repository has not provisioned any OCI resources.

The A1 allowance is the practical candidate for Coolify plus the app. Oracle's E2.1.Micro has 1 GB RAM and is not suitable for this combined workload. Coolify documents a 2-core/2-GB minimum; building and running five app services plus Coolify needs substantially more headroom. Even A1 can be slow during concurrent builds.

## 3. Network and firewall

Create or use a VCN with an internet gateway and a public subnet, then configure the subnet security list or an attached Network Security Group:

| Inbound TCP port | Source | Purpose |
|---|---|---|
| 22 | Your current public IP `/32` | SSH administration |
| 80, 443 | `0.0.0.0/0` (and `::/0` only if IPv6 is configured) | Coolify proxy and HTTP-01 certificate validation; open only when public access is explicitly approved |
| 8000, 6001, 6002 | Your current public IP `/32`, or omit and use an SSH tunnel | Coolify dashboard, realtime updates, and web terminal during initial setup |

Do **not** open 5432, 8080, or container port 80 to the Internet. NoteSphere's production Compose file publishes no host ports and puts PostgreSQL on an internal Docker network. Only the frontend is attached to Coolify's proxy network.

Restrict egress only if you understand the consequences; Ubuntu updates, image pulls, and certificate issuance need outbound connectivity. Oracle documents up to 10 TB/month of Always Free outbound data transfer. The single-VM design avoids a separate OCI load balancer; Oracle currently lists a 10-Mbps Always Free Flexible Load Balancer, but it is unnecessary here.

## 4. Free-tier limits and billing guardrails

- **Block storage:** 200 GB total for boot and block volumes combined in the home region; five volume backups total. Docker volumes stored on the boot disk consume that disk.
- **Object Storage:** the Always Free-only account allowance is 20 GB combined across Standard, Infrequent Access and Archive tiers, with 50,000 API requests/month. Off-site backups can exceed this; monitor usage.
- **Outbound traffic:** 10 TB/month Always Free.
- **Capacity:** A1 availability is not guaranteed. Oracle may reclaim an Always Free compute instance if its CPU, network, and (for A1) memory utilization remain below Oracle's stated thresholds over a seven-day period.
- **Account verification:** signup requires verification and may require a card. Free-trial credit, temporary holds, regional capacity, or another account's unused resources do not guarantee an Always Free VM.
- **Cost uncertainty:** Always Free service quotas do not guarantee every optional network/resource charge is zero. In particular, verify public-IP billing in your tenancy's price meter and cost estimator before assigning an address. A reserved IP, paid bandwidth/volume, out-of-region volume, or any non-eligible shape can create charges. Consequently, ₹0/month is a target, not a guarantee.
- **Budget alerts are warnings, not hard spending caps.** Review **Governance & Administration → Cost Management → Budgets** and **Limits, Quotas and Usage**. Do not enable paid upgrades or paid services to resolve a free-capacity error.

Official references: [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Free Tier FAQ](https://www.oracle.com/cloud/free/), and [VCN networking overview](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/overview.htm).
