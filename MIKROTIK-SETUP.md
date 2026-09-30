# MikroTik RouterOS Production Setup Guide
## Carrier-Grade WiFi Hotspot & FreeRADIUS AAA Integration

This guide provides the complete, production-ready configuration for your **MikroTik RouterOS gateway (v6 or v7)** to integrate with the WiFi Billing & Hotspot Platform hosted on your VPS.

---

## 1. Network Architecture Overview

```
                      [ INTERNET / VPS ]
                              │
                    Public IPv4 / WireGuard
                              │
                        [WAN ether1]
                      MikroTik Gateway
                     (RouterOS v6 / v7)
                              │
               [LAN Bridge: bridge-hotspot]
                       192.168.88.1/24
                       (DHCP: .10-.250)
                              │
                 ┌────────────┴────────────┐
                 │                         │
            Access Point              Access Point
           (SSID: FastWiFi)          (SSID: FastWiFi)
                 │                         │
             Guest Phone               Guest Laptop
```

### Key Values for Your Setup:
* **VPS Public IP**: `169.58.96.131`
* **Vercel Host**: `*.vercel.app` (or your custom domain e.g. `wifi.yourdomain.com`)
* **RADIUS Shared Secret**: Must match `RADIUS_SECRET` in your VPS `.env`
* **Hotspot IP Pool**: `192.168.88.0/24` (or your existing LAN/VLAN)
* **Router API Password**: Must match `MIKROTIK_PASSWORD` in your VPS `.env`

---

## 2. Fast 1-Click RouterOS CLI Script (Configured for VPS 169.58.96.131 & Vercel)

Open **Winbox** -> **Terminal** or SSH into your MikroTik router and run the following commands (replace `<YOUR_RADIUS_SECRET>` with the secret in your `.env`):

```routeros
# ==============================================================================
# 1. CONFIGURE FREERADIUS AAA CLIENT
# ==============================================================================
/radius
add service=hotspot address=169.58.96.131 secret="<YOUR_RADIUS_SECRET>" \
    authentication-port=1812 accounting-port=1813 timeout=3000ms comment="VPS-Billing-FreeRADIUS-169.58.96.131"

# Enable CoA / Packet of Disconnect Listener (Port 3799)
# This allows the VPS at 169.58.96.131 to disconnect users immediately when time or quota expires
/radius incoming
set accept=yes port=3799

# ==============================================================================
# 2. CONFIGURE HOTSPOT SERVER PROFILE FOR RADIUS
# ==============================================================================
/ip hotspot profile
set [find] use-radius=yes radius-accounting=yes radius-interim-update=1m \
    login-by=http-pap,http-chap nas-port-type=wireless-802.11 \
    html-directory=hotspot

# ==============================================================================
# 3. CONFIGURE WALLED GARDEN (Zero-Rated Access Before Payment)
# ==============================================================================
# 3.1 Allow Billing VPS Server & Vercel Frontend
/ip hotspot walled-garden ip
add action=accept dst-address=169.58.96.131 comment="Allow VPS Billing & API Backend"

/ip hotspot walled-garden
add dst-host=*.vercel.app comment="Allow Vercel Hosted Frontends"
add dst-host=cname.vercel-dns.com comment="Allow Vercel DNS"

# 3.2 Allow Safaricom Daraja M-Pesa Gateways
/ip hotspot walled-garden
add dst-host=*.safaricom.co.ke comment="Allow Safaricom Daraja API"
add dst-host=api.safaricom.co.ke comment="Allow Safaricom API"

/ip hotspot walled-garden ip
add action=accept dst-address=196.201.214.0/24 comment="Allow Safaricom Direct IP Block 1"
add action=accept dst-address=196.201.213.0/24 comment="Allow Safaricom Direct IP Block 2"

# 3.3 Allow OS Captive Network Assistant (CNA) Detection Probes
# This ensures iPhones, Androids, and Windows laptops automatically pop up the login window
/ip hotspot walled-garden
add dst-host=captive.apple.com comment="Apple CNA"
add dst-host=*.apple.com comment="Apple Services"
add dst-host=connectivitycheck.gstatic.com comment="Android CNA"
add dst-host=clients3.google.com comment="Android CNA Fallback"
add dst-host=*.gstatic.com comment="Google CNA"
add dst-host=*.msftconnecttest.com comment="Windows CNA"

# ==============================================================================
# 4. PROVISION DEDICATED BILLING API USER
# ==============================================================================
/user group
add name=billing_api policy=api,read,write,test,password comment="Billing Automation Group"

/user
add name=api_billing group=billing_api password="<SECURE_ROUTER_API_PASSWORD>" comment="Billing API User"

/ip service
set api disabled=no port=8728
set api-ssl disabled=no port=8729
```

---

## 3. Installing the Captive Portal `login.html` onto MikroTik

The MikroTik router needs a custom `login.html` file that immediately forwards guest devices to your VPS captive portal with their network attributes (`mac`, `ip`, `link-login`, etc.).

### Option A: 1-Click Automated Download via MikroTik `/tool fetch` (Recommended)

Run this directly in MikroTik Terminal:
```routeros
# For standard RouterBOARDs (stored in hotspot/)
/tool fetch url="https://<VPS_DOMAIN>/mikrotik/login.html" dst-path="hotspot/login.html" mode=https

# For Flash-based RouterBOARDs (stored in flash/hotspot/)
/tool fetch url="https://<VPS_DOMAIN>/mikrotik/login.html" dst-path="flash/hotspot/login.html" mode=https
```

---

### Option B: Manual Upload via Winbox / WebFig

1. Download `login.html` from your VPS portal:
   `https://<VPS_DOMAIN>/download/login.html`
   Or save this snippet as `login.html` on your computer:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FastNet Hotspot Portal</title>
  <meta http-equiv="refresh" content="0; url=https://<VPS_DOMAIN>/hotspot?mac=$(mac)&ip=$(ip)&username=$(username)&link-login=$(link-login)&link-login-only=$(link-login-only)&link-orig=$(link-orig)&error=$(error)">
  <script type="text/javascript">
    window.location.href = "https://<VPS_DOMAIN>/hotspot?mac=$(mac)&ip=$(ip)&username=$(username)&link-login=$(link-login)&link-login-only=$(link-login-only)&link-orig=$(link-orig)&error=$(error)";
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F172A; color: #F8FAFC; text-align: center; padding-top: 60px;">
  <h2 style="margin-bottom: 8px;">FastNet High-Speed WiFi</h2>
  <p style="color: #94A3B8;">Redirecting to internet packages &amp; M-Pesa billing...</p>
  <p style="margin-top: 24px;">
    <a href="https://<VPS_DOMAIN>/hotspot?mac=$(mac)&ip=$(ip)&link-login-only=$(link-login-only)" style="background: #10B981; color: #0F172A; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
      Click here to select an internet package
    </a>
  </p>
</body>
</html>
```

2. Open **Winbox** -> Navigate to **Files**.
3. Open the `hotspot` (or `flash/hotspot`) folder.
4. Drag and drop the `login.html` file into the folder, overwriting the default file.

---

## 4. Handling Routers Behind CGNAT / Private IPs (WireGuard VPN)

If your MikroTik router connects via 4G/5G SIM or an ISP that does not provide a Public IP, the VPS cannot directly reach the router on Port 8729 (API) or Port 3799 (CoA Disconnect).

### Solution: Built-in WireGuard VPN (RouterOS v7)

#### On the VPS:
```bash
apt install -y wireguard
wg genkey | tee server_private.key | wg pubkey > server_public.key
wg genkey | tee client_private.key | wg pubkey > client_public.key
```
Create `/etc/wireguard/wg0.conf`:
```ini
[Interface]
Address = 10.200.0.1/24
ListenPort = 51820
PrivateKey = <SERVER_PRIVATE_KEY>

[Peer]
PublicKey = <CLIENT_PUBLIC_KEY>
AllowedIPs = 10.200.0.2/32
```
Start WireGuard:
```bash
systemctl enable --now wg-quick@wg0
ufw allow 51820/udp
```

#### On the MikroTik Router (RouterOS v7):
```routeros
/interface wireguard
add name=wg-vps listen-port=13231 private-key="<CLIENT_PRIVATE_KEY>"

/interface wireguard peers
add interface=wg-vps public-key="<SERVER_PUBLIC_KEY>" endpoint-address="<VPS_PUBLIC_IP>" endpoint-port=51820 allowed-address=10.200.0.0/24 persistent-keepalive=25s

/ip address
add address=10.200.0.2/24 interface=wg-vps

# Update RADIUS server to point through VPN tunnel:
/radius set [find] address=10.200.0.1
```
With WireGuard active, the VPS and MikroTik can communicate with zero firewall or CGNAT issues!

---

## 5. Testing & Verification Checklist

### 5.1 Test RADIUS Communication from MikroTik
Run in MikroTik Terminal:
```routeros
# Check RADIUS server statistics
/radius monitor [find]
```
Look for:
* `requests`: incrementing
* `accepts`: incrementing
* `timeouts`: 0

### 5.2 Test User Authentication Flow
1. Connect mobile phone to Hotspot WiFi SSID.
2. The phone should automatically trigger the Captive Network Assistant (CNA) and show the VPS billing portal.
3. Select a package and pay with M-Pesa STK push (or redeem a voucher).
4. Once verified, the portal submits the authentication form back to MikroTik via `link-login-only`.
5. Check active sessions on MikroTik:
```routeros
/ip hotspot active print
```
6. Check dynamic simple queue bandwidth limit:
```routeros
/queue simple print
```
Rate-limits (e.g. `5M/2M`) will be dynamically enforced by MikroTik.

### 5.3 Test Real-Time Expiry / Disconnect (CoA)
When a user's time expires or data is exhausted, the VPS BullMQ worker sends a CoA Disconnect-Request packet to the router on UDP 3799.
Check on MikroTik:
```routeros
/log print where topics~"radius"
```
You will see: `radius disconnect request received for <username>`. The user is immediately dropped back to the captive portal.
