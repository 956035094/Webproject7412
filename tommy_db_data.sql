CREATE TABLE IF NOT EXISTS users (
    u_id INT AUTO_INCREMENT PRIMARY KEY,
    given_name VARCHAR(50),
    family_name VARCHAR(50),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(256),
    email VARCHAR(128),
    role VARCHAR(16) DEFAULT 'user',
    temperature FLOAT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS posts (
    p_id INT AUTO_INCREMENT PRIMARY KEY,
    author INT,
    title TEXT,
    content LONGTEXT,
    timestamp DATETIME,
    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0,
    FOREIGN KEY (author) REFERENCES users(u_id) ON DELETE SET NULL
);