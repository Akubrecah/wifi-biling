FROM freeradius/freeradius-server:3.2.3-alpine

# Install postgresql module and CLI utilities for freeradius
RUN apk add --no-cache \
    freeradius-postgresql \
    freeradius-utils \
    postgresql-client

# Copy custom configurations
COPY clients.conf /etc/raddb/clients.conf
COPY sql.conf /etc/raddb/mods-available/sql

# Enable SQL module
RUN ln -sf /etc/raddb/mods-available/sql /etc/raddb/mods-enabled/sql

EXPOSE 1812/udp 1813/udp 3799/udp

CMD ["radiusd", "-f", "-l", "stdout"]
