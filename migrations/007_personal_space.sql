-- Personal resources are independent of workspace membership.
ALTER TABLE messages ADD COLUMN detection_timezone text NOT NULL DEFAULT 'UTC';
CREATE TABLE friend_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 client_id uuid NOT NULL,
 content text NOT NULL CHECK(length(content) BETWEEN 1 AND 8000),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 CHECK(sender_id <> recipient_id),
 UNIQUE(sender_id,client_id)
);
CREATE INDEX friend_messages_pair ON friend_messages(sender_id,recipient_id,created_at DESC,id DESC);
CREATE INDEX friend_messages_unread ON friend_messages(recipient_id,sender_id) WHERE read_at IS NULL;
CREATE TABLE place_categories (
 key text PRIMARY KEY, name text NOT NULL, enabled boolean NOT NULL DEFAULT true
);
INSERT INTO place_categories(key,name) VALUES ('burger-king','Burger King');
CREATE TABLE places (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 category text NOT NULL REFERENCES place_categories(key),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 address text NOT NULL DEFAULT '' CHECK(length(address)<=300),
 latitude double precision NOT NULL CHECK(latitude BETWEEN -85 AND 85),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(category,latitude,longitude)
);
CREATE INDEX places_bounds ON places(latitude,longitude);
CREATE TABLE place_entries (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
 state text NOT NULL CHECK(state IN ('wishlist','visited')),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','friends','community')),
 visited_on date,
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,place_id)
);
