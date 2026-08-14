-- Las nuevas contraseñas se guardan con hash scrypt, no como texto visible.
ALTER TABLE usuarios MODIFY password VARCHAR(255) NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL AFTER password;
