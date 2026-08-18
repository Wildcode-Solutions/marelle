ALTER TABLE users
ADD COLUMN role TEXT NOT NULL DEFAULT 'student'
CHECK (role IN ('student', 'admin'));

CREATE INDEX idx_users_role ON users (role);
