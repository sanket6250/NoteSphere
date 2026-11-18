# Free subdomain and HTTPS

This guide is conditional: the current NoteSphere API has no authentication. Do not route a public domain to it until application authentication/authorization or another approved access-control layer protects **all** UI and API routes. HTTPS encrypts traffic; it does not prevent unauthorized access.

## 1. Choose free DNS

An example is [Duck DNS](https://www.duckdns.org/), which offers free subdomains. Review its current terms and availability yourself. Do not put its update token in Git or a Compose file.

1. Register a subdomain with a free DNS provider.
2. Add an `A` record pointing at the VM's current public IPv4 address. Use the actual address displayed in OCI; never hardcode a sample IP.
3. If you also configure IPv6, add an `AAAA` record only after confirming the VM and firewall support it.
4. Use an ephemeral instance address only after verifying OCI pricing and update the DNS record if the address changes. A reserved address or other network resource may have a different charge.
5. Wait for DNS propagation and verify resolution from outside the VM:

   ```sh
   dig +short your-subdomain.example
   ```

## 2. Add the route in Coolify

After the app is access-controlled and public exposure is approved:

1. Open the NoteSphere Compose resource's **Domains** settings.
2. Add the chosen hostname, select service `frontend`, and set the internal port to `80`.
3. Enable HTTPS/Let's Encrypt in Coolify's proxy settings and wait for certificate issuance.
4. Coolify's proxy terminates HTTPS and forwards HTTP over its private Docker network to Nginx. Nginx proxies `/api/` to the backend on the private API network. PostgreSQL, RustFS and the API do not receive direct public routes.
5. Keep port 22 restricted to your IP; allow 80/443 only for the public site. Do not publish 5432/8080/9000/9001 or direct Coolify dashboard ports.

Let's Encrypt certificates are free. HTTP-01 validation needs public DNS to point to the host and inbound port 80 to be reachable by the certificate authority. If your private-access policy prevents that, do not weaken the firewall just to issue a certificate; use a supported DNS-01 workflow or wait until public access has been approved and secured.

See [Coolify's firewall guide](https://coolify.io/docs/core/infrastructure/servers/firewall) and [deployment guide](./NOTESPHERE_DEPLOYMENT.md). No DNS account or certificate has been created by this project.
