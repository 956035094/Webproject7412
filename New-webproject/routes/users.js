var argon2 = require('argon2');
var express = require('express');
var router = express.Router();
var sanitizeHtml = require('sanitize-html');

const MFA_TTL = 5 * 60 * 1000;

function sendJson(res, status, payload) {
    res.status(status).json(payload);
}

function clearMfaSession(req) {
    delete req.session.mfaCode;
    delete req.session.mfaExpires;
    delete req.session.mfaUser;
}

router.post('/login', function(req, res, next) {

     if('username' in req.body && req.body.username !== null
        && 'password' in req.body && req.body.password !== null) {

        req.pool.getConnection(function(err,connection) {
            if (err) {
                console.log(err);
                sendJson(res, 500, {ok:false, message:"Database error."});
                return;
            }
            var query = `SELECT u_id,given_name,family_name,username,email,role,password_hash
                            FROM users WHERE username = ?`;
            connection.query(query,[req.body.username], async function(qerr, rows, fields) {
              connection.release(); // release connection
              if (qerr) {
                console.log(qerr);
                sendJson(res, 500, {ok:false, message:"Database error."});
                return;
              }
              if(rows.length === 0){
                  sendJson(res, 401, {ok:false, message:"Invalid username or password."});
                  return;
              }

              const valid = await argon2.verify(rows[0].password_hash, req.body.password);

              if (!valid) {
                  sendJson(res, 401, {ok:false, message:"Invalid username or password."});
                  return;
              }

              // MFA validation
              const submittedCode = req.body.code;
              if (!submittedCode) {
                  sendJson(res, 401, {ok:false, message:"MFA code required."});
                  return;
              }
              if (!req.session.mfaCode || !req.session.mfaExpires || !req.session.mfaUser) {
                  sendJson(res, 401, {ok:false, message:"Please request a MFA code first."});
                  return;
              }
              if (req.session.mfaUser !== req.body.username) {
                  sendJson(res, 401, {ok:false, message:"MFA code does not match this user."});
                  return;
              }
              if (Date.now() > req.session.mfaExpires) {
                  clearMfaSession(req);
                  sendJson(res, 401, {ok:false, message:"MFA code expired. Please request a new one."});
                  return;
              }
              if (req.session.mfaCode !== submittedCode) {
                  sendJson(res, 401, {ok:false, message:"Incorrect MFA code."});
                  return;
              }

              clearMfaSession(req);

              req.session.user = rows[0];
              delete req.session.user.password_hash;
              res.cookie('role', req.session.user.role);
              sendJson(res, 200, {ok:true, message:"Login successful.", user:req.session.user});
            });
        });


    } else {
        sendJson(res, 400, {ok:false, message:"Username and password required."});
    }

});


router.post('/mfa/send', function(req, res, next) {

    const { username } = req.body || {};
    if (!username) {
        sendJson(res, 400, {ok:false, message:"Username required to send MFA code."});
        return;
    }

    req.pool.getConnection(function(err, connection) {
        if (err) {
            console.log(err);
            sendJson(res, 500, {ok:false, message:"Database error."});
            return;
        }

        const query = `SELECT u_id FROM users WHERE username = ?`;
        connection.query(query, [username], function(qerr, rows) {
            connection.release();
            if (qerr) {
                console.log(qerr);
                sendJson(res, 500, {ok:false, message:"Database error."});
                return;
            }

            if (rows.length === 0) {
                sendJson(res, 404, {ok:false, message:"User not found."});
                return;
            }

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            req.session.mfaCode = code;
            req.session.mfaExpires = Date.now() + MFA_TTL;
            req.session.mfaUser = username;

            sendJson(res, 200, {ok:true, message:`The verification code has been generated: ${code}`});
        });
    });
});


router.post('/signup', async function(req, res, next) {

    if('username' in req.body && req.body.username !== null
        && 'password' in req.body && req.body.password !== null
        && 'email' in req.body
        && 'given_name' in req.body
        && 'family_name' in req.body) {


        let hash = await argon2.hash(req.body.password);
        console.log(hash);

        req.pool.getConnection(function(err,connection) {
            if (err) {
                console.log(err);
                sendJson(res, 500, {ok:false, message:"Database error."});
                return;
            }
            var query = `INSERT INTO users (given_name,family_name,username,password_hash,email,role)
                            VALUES (?,?,?,?,?,'user');`;
            connection.query(query,[
                sanitizeHtml(req.body.given_name),
                sanitizeHtml(req.body.family_name),
                sanitizeHtml(req.body.username),
                hash,
                req.body.email], function(qerr, rows, fields) {
              connection.release(); // release connection
              if (qerr) {
                console.log(qerr);
                sendJson(res, 500, {ok:false, message:"Signup failed. Username may already exist."});
                return;
              }
              sendJson(res, 200, {ok:true, message:"Signup successful. Please log in with your credentials."});
            });
        });



    } else {
        sendJson(res, 400, {ok:false, message:"Missing required signup fields."});
    }

});


router.use(function(req, res, next) {
    if('user' in req.session){
        next();
    } else {
        sendJson(res, 401, {ok:false, message:"Not logged in."});
    }
});

router.get('/profile', function(req, res, next) {

    if (!req.session.user) {
        return sendJson(res, 401, {ok:false, message:"Not logged in."});
    }

    req.pool.getConnection(function(err, connection) {
        if (err) {
            console.log(err);
            return sendJson(res, 500, {ok:false, message:"Database error."});
        }

        let query = `SELECT given_name, family_name, email, temperature
                     FROM users WHERE u_id = ?`;

        connection.query(query, [req.session.user.u_id], function(qerr, rows) {
            connection.release();

            if (qerr) {
                console.log(qerr);
                return sendJson(res, 500, {ok:false, message:"Database error."});
            }

            if (rows.length === 0) return sendJson(res, 404, {ok:false, message:"Profile not found."});

            sendJson(res, 200, Object.assign({ok:true}, rows[0]));
        });
    });
});

router.post('/update_profile', function(req, res, next) {

    if (!req.session.user) {
        return sendJson(res, 401, {ok:false, message:"Not logged in."});
    }

    const { given_name, family_name, email } = req.body;

    req.pool.getConnection(function(err, connection) {
        if (err) {
            console.log(err);
            return sendJson(res, 500, {ok:false, message:"Database error."});
        }

        let query = `UPDATE users
                     SET given_name = ?, family_name = ?, email = ?
                     WHERE u_id = ?`;

        connection.query(
            query,
            [given_name, family_name, email, req.session.user.u_id],
            function(qerr) {
                connection.release();

                if (qerr) {
                    console.log(qerr);
                    return sendJson(res, 500, {ok:false, message:"Update failed."});
                }

                sendJson(res, 200, {ok:true, message:"Profile updated successfully."});
            }
        );
    });
});

router.post('/update_temp', function(req, res, next) {

    if (!req.session.user) {
        return sendJson(res, 401, { ok: false, message: "Not logged in." });
    }

    const { temperature } = req.body;
    const tempValue = parseFloat(temperature);

    req.pool.getConnection(function(err, connection) {
        if (err) {
            return sendJson(res, 500, { ok:false, message:"Database error." });
        }

        let query = `UPDATE users SET temperature = ? WHERE u_id = ?`;

        connection.query(
            query,
            [tempValue, req.session.user.u_id],
            function(qerr) {
                connection.release();

                if (qerr) {
                    return sendJson(res, 500, { ok:false, message:"Temperature update failed." });
                }

                sendJson(res, 200, { ok:true, message:"Temperature saved." });
            }
        );
    });
});


router.post('/logout', function(req, res, next) {

    delete req.session.user;
    res.cookie('role', 'anon');
    sendJson(res, 200, {ok:true, message:"Logged out."});

});






module.exports = router;
