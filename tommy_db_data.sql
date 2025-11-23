DROP DATABASE IF EXISTS tommy;
CREATE DATABASE tommy;
USE tommy;

CREATE TABLE users (
    u_id INT AUTO_INCREMENT,
    given_name VARCHAR(50),
    family_name VARCHAR(50),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(128),
    role VARCHAR(16) DEFAULT 'user',
    password_hash VARCHAR(256),
    temperature FLOAT DEFAULT NULL,
    PRIMARY KEY (u_id)
);

CREATE TABLE posts (
    p_id INT AUTO_INCREMENT,
    author INT,
    title TEXT,
    content LONGTEXT,
    timestamp DATETIME,
    PRIMARY KEY (p_id),
    FOREIGN KEY (author) REFERENCES users(u_id) ON DELETE SET NULL
);

ALTER TABLE posts
ADD COLUMN likes INT DEFAULT 0,
ADD COLUMN dislikes INT DEFAULT 0;