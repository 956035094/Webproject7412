const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("./db-aiven");

passport.serializeUser((user, done) => {
    done(null, user.u_id);
});

passport.deserializeUser((id, done) => {
    db.query("SELECT * FROM users WHERE u_id = ?", [id], (err, rows) => {
        if (err) return done(err);
        done(null, rows[0]);
    });
});

passport.use(new GoogleStrategy({
    clientID: "383038343372-8sfgge2su57vv2ld7unovfhld9lr5cf9.apps.googleusercontent.com",
    clientSecret: "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",
    callbackURL: "https://supreme-telegram-rxx65gvp5543p9p6-3000.app.github.dev/auth/google/callback"
},
function(accessToken, refreshToken, profile, done) {

    const email = profile.emails[0].value;
    const givenName = profile.name.givenName;
    const familyName = profile.name.familyName;


    db.query("SELECT * FROM users WHERE email = ?", [email], (err, rows) => {
        if (err) return done(err);

        if (rows.length > 0) {
            return done(null, rows[0]);
        }


        const newUser = {
            given_name: givenName,
            family_name: familyName,
            username: email,
            email: email,
            role: "user",
            password_hash: "google-oauth"
        };

        db.query("INSERT INTO users SET ?", newUser, (err2, result) => {
            if (err2) return done(err2);

            newUser.u_id = result.insertId;
            return done(null, newUser);
        });
    });

}));