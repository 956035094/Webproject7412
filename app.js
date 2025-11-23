require("dotenv").config();
var express = require('express');
var app = express();
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const session = require("express-session");
const passport = require("passport");
require("./google-auth");

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

const dbConnectionPool = require("./db-aiven");

app.use(function(req, res, next) {
    req.pool = dbConnectionPool;
    next();
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(session({
    secret: 'a706835de79a2b4e90506f582af3676ac8361521',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
    if('user' in req.session){
        res.cookie('role', req.session.user.role);
    } else {
        res.cookie('role', 'anon');
    }
    next();
});

// Redirect anonymous users visiting the root to the login page
app.get('/', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/compose.html', '/profile.html'], function(req, res) {
    if (!req.session.user) {
        const target = encodeURIComponent(req.path);
        return res.redirect(`/login.html?target=${target}`);
    }
    const fileName = req.path.replace(/^\//, '');
    res.sendFile(path.join(__dirname, 'public', fileName));
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// Google auth
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"], prompt: "login"})

);

app.get("/auth/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/login.html"
    }),
    function (req, res) {
        req.session.user = {
            u_id: req.user.u_id,
            given_name: req.user.given_name,
            family_name: req.user.family_name,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        };

        res.redirect("/");
    }
);

// function initialise_db(){
//     dbConnectionPool.getConnection(function(err, connection) {
//         if (err) {
//             console.error("DB connection error:", err);
//             return;
//         }

//         var setup = `
//         CREATE DATABASE IF NOT EXISTS tommy;
//         USE tommy;

//         CREATE TABLE IF NOT EXISTS users (
//             u_id INT AUTO_INCREMENT,
//             given_name VARCHAR(50),
//             family_name VARCHAR(50),
//             username VARCHAR(50) UNIQUE NOT NULL,
//             email VARCHAR(128),
//             role VARCHAR(16),
//             password_hash VARCHAR(256),
//             temperature FLOAT DEFAULT NULL,
//             PRIMARY KEY (u_id)
//         );

//         CREATE TABLE IF NOT EXISTS posts (
//             p_id INT AUTO_INCREMENT,
//             author INT,
//             title TEXT,
//             content LONGTEXT,
//             timestamp DATETIME,
//             PRIMARY KEY (p_id),
//             FOREIGN KEY (author) REFERENCES users(u_id) ON DELETE SET NULL
//         );
//         `;

//         connection.query(setup, function(qerr) {
//             connection.release();
//             if (qerr) {
//                 console.error("DB Init Error:", qerr);
//             } else {
//                 console.log("Database connection successful.");
//             }
//         });
//     });
// }

// initialise_db();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});

module.exports = app;
