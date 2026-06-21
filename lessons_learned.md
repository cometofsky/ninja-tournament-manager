# Lessons Learned

## 2026-06-21
- Created a bare-metal deployment script for Next.js applications on VPS hosting.
- Evaluated integration mechanisms between a host-based (bare-metal) service and containerized Traefik proxy.
- Documented two main integration paths:
  1. **Docker Proxy Container**: Running a lightweight container (like `alpine/socat`) on the Traefik network that forwards ports to the host (`host.docker.internal`), allowing normal Traefik container label discovery without changing Traefik's dynamic file configurations.
  2. **Traefik File Provider**: Adding a dynamic YAML configuration routing a rule to the Docker bridge gateway IP (`172.17.0.1`).
- Cleaned up obsolete Vercel configuration files (`vercel.json`) and specific segment configurations (`maxDuration`) when migrating from Vercel to VPS hosting.
