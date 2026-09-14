-- Product lines carry a lineup photo. Existing rows keep NULL until an import supplies one.
ALTER TABLE product_lines ADD COLUMN image TEXT;
