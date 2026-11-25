-- =====================================================================
-- 07_unit_tours.sql : room-by-room house tours for each unit
-- Idempotent - safe to run on an existing database
--   dotnet run --project tools/Keyzo.DbTool -- migrate
-- A tour is an ordered list of stops (exterior -> door -> hall -> bedrooms
-- -> kitchen -> bathroom -> balcony). Each stop points at a property photo
-- and stores the "focal point" (0-100 %) the camera walks toward when
-- moving on to the next room - usually the doorway in the photo.
-- Units without stops get an automatic tour from the built-in photo library.
-- =====================================================================
USE keyzo;

CREATE TABLE IF NOT EXISTS unit_tour_stops (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_id     BIGINT UNSIGNED NOT NULL,
  seq         SMALLINT        NOT NULL,
  room_type   ENUM('exterior','door','hall','bedroom','kitchen','bathroom','balcony','other') NOT NULL,
  image_id    BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(80)     NOT NULL,
  caption     VARCHAR(200)    NULL,
  focal_x     DECIMAL(5,2)    NOT NULL DEFAULT 50,
  focal_y     DECIMAL(5,2)    NOT NULL DEFAULT 50,
  created_at  DATETIME        NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tour_unit_seq (unit_id, seq),
  KEY ix_tour_image (image_id),
  CONSTRAINT fk_tour_unit  FOREIGN KEY (unit_id)  REFERENCES property_units(id)  ON DELETE CASCADE,
  CONSTRAINT fk_tour_image FOREIGN KEY (image_id) REFERENCES property_images(id) ON DELETE CASCADE,
  CONSTRAINT ck_tour_focal CHECK (focal_x BETWEEN 0 AND 100 AND focal_y BETWEEN 0 AND 100),
  CONSTRAINT ck_tour_seq   CHECK (seq >= 0)
) ENGINE=InnoDB;
