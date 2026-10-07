# Country boundary data

`russiaBoundary.json` is the Russia geometry extracted without simplification from Natural Earth 1:10m Admin 0 Countries, pinned to v5.1.2. Crimea is explicitly excluded with the existing peninsula polygon:

- Source: https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_admin_0_countries.geojson
- Public domain terms: https://www.naturalearthdata.com/about/
- Boundary policy: https://www.naturalearthdata.com/about/disputed-boundaries-policy/

Used offline to replace rectangular bounding boxes. Country geometry is approximate cartographic data, not border attestation. Device GPS can also be spoofed; this is an app eligibility rule, not a server security boundary. Regression tests include northeastern Ukraine, Poland, Rostov, Kaliningrad and Crimea.
