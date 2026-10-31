# Hosting the site on AWS EC2

The site runs on one small AWS EC2 instance (Ubuntu) with a free
`something.duckdns.org` address and automatic HTTPS. Plan about an hour the
first time.

You need: an AWS account (card for identity check), the code pushed to GitHub
(all current changes committed), and a laptop with a terminal (macOS/Linux,
or Windows PowerShell).

For a 3–4 month season the new-account free credits usually cover it — check
the current free-tier terms when you sign up, and set the budget alert below.

---

## Part A — create the EC2 instance

1. Sign up at **https://aws.amazon.com**. In the console, choose region
   **Asia Pacific (Mumbai)** (top-right).
2. Set a budget alert first: *Billing and Cost Management → Budgets → Create
   budget* (e.g. a US$5 monthly cost budget emailing you). Check what your
   free credits cover while you're there.
3. *EC2 → Launch instance*:

   | Setting | Choose |
   |---|---|
   | Name | `npl-sports` |
   | Image (AMI) | **Ubuntu Server 24.04 LTS** |
   | Instance type | **t4g.small** (ARM, 2 GB) — or **t3.micro** (1 GB; setup adds swap) |
   | Key pair | **Create new key pair** → `.pem` → it downloads; keep it safe |
   | Network settings → Firewall | **Create security group**: tick **Allow SSH from My IP**, **Allow HTTPS from the internet**, **Allow HTTP from the internet** |
   | Storage | 20–30 GB gp3 |

4. *Launch instance*, open it, and note its **Public IPv4 address**.
   (Optional: allocate an **Elastic IP** and associate it so the address never
   changes — DuckDNS copes with changes anyway. Release it when you shut down.)

Log in from your laptop:

```bash
chmod 600 ~/Downloads/npl-sports.pem
ssh -i ~/Downloads/npl-sports.pem ubuntu@<public-ip>
```

The security group is the firewall: only SSH (from your IP), HTTP and HTTPS
are open.

---

## Part B — install the site

### B1. Get a free address at DuckDNS

1. Sign in at **https://www.duckdns.org** (Google/GitHub login).
2. Add a sub domain, e.g. `rnw-sports` → your site will be
   **`rnw-sports.duckdns.org`**. Put the server's public IP in *current ip*.
3. Copy the **token** shown at the top of the page.

### B2. Put the code on the server

The repo is private, so give the server a **read-only deploy key**. On the
server:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/npl_deploy -N "" -C "npl server"
cat ~/.ssh/npl_deploy.pub
```

On GitHub: *repo → Settings → Deploy keys → Add deploy key*, paste that line,
**leave "Allow write access" unticked**. Then on the server:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/npl_deploy
  IdentitiesOnly yes
EOF
git clone git@github.com:<your-github-user>/npl-tournaments.git
cd npl-tournaments
```

### B3. Run the setup (once)

```bash
sudo ./deploy/setup.sh
```

It asks for:

- **Site address** — `rnw-sports.duckdns.org`
- **DuckDNS token** — from B1 (typing is hidden)
- **First community access code** — e.g. `volley-maple-48` (no quotes or `#`)

It installs everything, starts the site and prints the **admin code once —
save it in a password manager.** The first run takes ~5–10 minutes.

### B4. Open the site

Go to **https://rnw-sports.duckdns.org** — the first visit can take a minute
while the HTTPS certificate is issued. Enter the community code (residents)
or the admin code (staff).

---

## Everyday tasks

Run on the server, inside `npl-tournaments/`:

| Task | Command |
|---|---|
| Is it up? | `./deploy/npl status` |
| Deploy the latest code from GitHub (backs up first) | `./deploy/npl update` |
| See what's happening | `./deploy/npl logs` (Ctrl+C to stop) |
| Take a backup now | `./deploy/npl backup` |
| List backups | `./deploy/npl backups` |
| Restore a backup | `./deploy/npl restore /var/backups/npl/<file>` |
| New admin code (old one stops working) | `./deploy/npl admin-code` |
| Change the community code | on the site: Admin → **Access** |

Automatic, no action needed: security updates (with a reboot at 04:30 when
required — the site comes back by itself), HTTPS renewal, DuckDNS updates,
nightly backups at 03:30.

### Keep a copy of the backups off the server

Backups live on the same server — if it's lost, so are they. About once a
month (and before big changes), download them to your laptop:

```bash
ssh -i <your-key-file> ubuntu@<public-ip> \
  "sudo tar -C /var/backups/npl -cf - ." > npl-backups-$(date +%F).tar
```

Every night saves a small database backup (last 30 kept); on Sundays it also
saves a full backup with all photos (last 2 kept).

### Moving to a new server

Create the new server (part A), run B2–B3, copy a `npl-full-….tar.gz` backup to
it, then `./deploy/npl restore <file>`. The setup re-points DuckDNS at the new
IP automatically.

### Bringing over the old Firebase data (once)

Firebase console → Realtime Database → ⋮ → **Export JSON**, copy the file to
the server (e.g. `scp -i <key> export.json ubuntu@<ip>:~`), then:

```bash
./deploy/npl import ~/export.json --download-gallery
```

Results, teams, schedules, settings and photo records come across; old
resident accounts are deliberately left behind.

---

## Shutting it down (end of the season)

1. Download a final backup to your laptop (above) — keep it if you might want
   the results or photos later.
2. Delete the server: *EC2 → Instances → Terminate*; then *Elastic IPs →
   Release* any address (an unattached Elastic IP is charged) and check
   *Volumes* and *Snapshots* for leftovers.
3. Delete the subdomain at duckdns.org, and remove the deploy key from the
   GitHub repo (*Settings → Deploy keys*).
4. A few days later, check the billing page to confirm nothing is still
   running.

---

## Troubleshooting

- **Site doesn't load** — check the instance's security group allows HTTP
  (80) and HTTPS (443) from anywhere, then
  `./deploy/npl status` and `./deploy/npl logs caddy`. Certificate errors in
  the Caddy log usually mean the DuckDNS address doesn't point at this server
  yet, or port 80 is blocked.
- **"That code is not right" for the admin code** — run
  `./deploy/npl admin-code` to make a fresh one.
- **Can't SSH in** — use the key file from part A and the user `ubuntu`.
  Password login is turned off on purpose. "My IP" in the security group is
  your IP at creation time — update the SSH rule if your IP changed.

## Security notes

- `.env` holds the secrets (mode 600). Never commit or share it.
- Change the community code each season (Admin → Access) — every device is
  signed out and needs the new one.
- The security group only opens SSH (from your IP), 80 and 443; fail2ban
  blocks repeated SSH attempts; security updates install automatically.
