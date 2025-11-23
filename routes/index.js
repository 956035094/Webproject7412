var express = require('express');
var router = express.Router();
var sanitizeHtml = require('sanitize-html');

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

router.get('/posts', function(req, res, next) {

  if('user' in req.session){
      console.log(req.session.user);
  }

  req.pool.getConnection(function(err,connection) {
      if (err) {
        console.error(err);
        return sendJson(res, 500, {ok:false, message:"Error loading posts."});
      }
      var query = `SELECT  users.given_name AS author_name,
                          users.u_id AS author_id,
                          users.email AS author_email,
                          posts.title,
                          posts.content,
                          posts.timestamp,
                          posts.p_id AS post_id,
                          posts.likes,
                          posts.dislikes
                  FROM posts LEFT JOIN users ON posts.author = users.u_id
                  ORDER BY posts.timestamp DESC
                  LIMIT 10;`;
      connection.query(query, function(qerr, rows, fields) {
        connection.release();
        if (qerr) {
          console.error(qerr);
          return sendJson(res, 500, {ok:false, message:"Error loading posts."});
        }
        let alerts = rows.filter(p => p.title && p.title.startsWith('[System Alert]'));
        if (alerts.length > 0) {
            const latestAlert = alerts[0];
            rows = [
                latestAlert,
                ...rows.filter(p => !(p.title && p.title.startsWith('[System Alert]')))
            ];
        }
        res.json(rows);
      });
  });

});


router.post('/posts/new', function(req, res, next) {

    if(!('user' in req.session)){
      res.sendStatus(401);
      return;
    }
    console.log(req.session.user);

    if("title" in req.body && req.body.title !== null
        &&"content" in req.body && req.body.content !== null) {
        req.body.author = req.session.user;

        req.pool.getConnection(function(err,connection) {
            if (err) {
              res.sendStatus(500);
              console.error(err);
              return;
            }
            var query = `INSERT INTO posts (author,title,content,timestamp) VALUES (?,?,?,NOW());`;
            connection.query(query, [req.body.author.u_id,req.body.title,sanitizeHtml(req.body.content)], function(qerr, rows, fields) {
                if (qerr) {
                    res.sendStatus(500);
                    console.error(qerr);
                    connection.release();
                    return;
                }

                res.json({ ok:true, message:"Blog Post Successful..." });

            });
        });

    } else {
        res.sendStatus(400);
    }

});

router.post('/system/infection_broadcast', function(req, res, next){

    req.pool.getConnection(function(err, connection) {
        if (err) {
            console.error(err);
            return sendJson(res, 500, {ok:false, message:"Database error."});
        }
        const infectedQuery = `SELECT given_name, family_name FROM users WHERE temperature > 37.3;`;
        connection.query(infectedQuery, function(qerr, rows) {
            if (qerr) {
                connection.release();
                console.error(qerr);
                return sendJson(res, 500, {ok:false, message:"Database error."});
            }

            const names = rows
                .map(r => `${r.given_name} ${r.family_name}`)
                .join(', ') || 'No data available';

            const title = "[System Alert] Possible COVID-19 Case Detected";
            const content = `Today's suspected infected users: ${names}`;
            const insertQuery = `
                INSERT INTO posts (author, title, content, timestamp)
                VALUES (NULL, ?, ?, NOW());
            `;

            connection.query(insertQuery, [ title, sanitizeHtml(content) ], function(insertErr) {
                connection.release();

                if (insertErr) {
                    console.error(insertErr);
                    return sendJson(res, 500, {ok:false, message:"Failed to broadcast infection report."});
                }
                return sendJson(res, 200, {ok:true, message:"System broadcast posted.", names});
            });
        });

    });

});

router.get('/posts/:post_id/comments', function(req, res, next) {

  if('user' in req.session){
      console.log(req.session.user);
  }

  req.pool.getConnection(function(err,connection) {
      if (err) {
        console.error(err);
        return sendJson(res, 500, {ok:false, message:"Error loading comments."});
      }
      var query = `SELECT users.given_name AS author_name,
                          users.u_id AS author_id,
                          comments.title,
                          comments.content,
                          comments.timestamp,
                          comments.c_id AS comment_id
                    FROM comments INNER JOIN users ON comments.author = users.u_id
                    WHERE comments.post = ?;`;
      connection.query(query, [req.params.post_id], function(qerr, rows, fields) {
        connection.release();
        if (qerr) {
          console.error(qerr);
          return sendJson(res, 500, {ok:false, message:"Error loading comments."});
        }
        res.json(rows);
      });
  });

});

router.post('/posts/:post_id/delete', function(req, res, next) {

  if(!('user' in req.session)){
    return sendJson(res, 401, {ok:false, message:"Not logged in."});
  }

  switch(req.session.user.role){
    case 'user':
      return sendJson(res, 401, {ok:false, message:"Admin privileges required to delete posts."});
    case 'admin':
      break;
    default:
      return sendJson(res, 401, {ok:false, message:"Admin privileges required to delete posts."});
  }

  req.pool.getConnection(function(err,connection) {
      if (err) {
        console.error(err);
        return sendJson(res, 500, {ok:false, message:"Database error."});
      }
      var query = `DELETE FROM posts WHERE p_id=?;`;
      connection.query(query, [req.params.post_id], function(qerr, rows, fields) {
        connection.release();
        if (qerr) {
          console.error(qerr);
          return sendJson(res, 500, {ok:false, message:"Error deleting post."});
        }
        sendJson(res, 200, {ok:true, message:"Post deleted."});
      });
  });

});

router.post('/comments/new', function(req, res, next) {

  if(!('user' in req.session)){
    return sendJson(res, 401, {ok:false, message:"Please log in first."});
  }

  if("title" in req.body && req.body.title !== null
      && "content" in req.body && req.body.content !== null
      && "post_id" in req.body && req.body.post_id !== null) {
      req.body.author = req.session.user;

      req.pool.getConnection(function(err,connection) {
          if (err) {
            return sendJson(res, 500, {ok:false, message:"Database error."});
          }
          var query = `INSERT INTO comments (author,title,content,timestamp,post) VALUES (?,?,?,NOW(),?);`;
          connection.query(query, [req.body.author.u_id,req.body.title,req.body.content,req.body.post_id], function(qerr, rows, fields) {
              if (qerr) {
                  console.error(qerr);
                  connection.release(); // release connection if error
                  return sendJson(res, 500, {ok:false, message:"Error adding comment."});
              }

              connection.release();
              sendJson(res, 200, {ok:true, message:"Comment added."});

          });
      });

  } else {
      sendJson(res, 400, {ok:false, message:"Missing fields."});
  }

});

router.post('/posts/:id/like', function(req, res) {
    const postId = req.params.id;

    req.pool.getConnection(function(err, connection) {
        if (err) {
            console.error(err);
            return sendJson(res, 500, {ok:false, message:"Database error."});
        }

        const updateQuery = `UPDATE posts SET likes = likes + 1 WHERE p_id = ?`;

        connection.query(updateQuery, [postId], function(qerr) {
            if (qerr) {
                connection.release();
                console.error(qerr);
                return sendJson(res, 500, {ok:false, message:"Like failed."});
            }
            const selectQuery = `SELECT likes FROM posts WHERE p_id = ?`;
            connection.query(selectQuery, [postId], function(err2, rows) {
                connection.release();
                if (err2) {
                    console.error(err2);
                    return sendJson(res, 500, {ok:false, message:"Database error."});
                }

                return sendJson(res, 200, {
                    ok: true,
                    likes: rows[0].likes
                });
            });
        });
    });
});

router.post('/posts/:id/dislike', function(req, res) {
    const postId = req.params.id;

    req.pool.getConnection(function(err, connection) {
        if (err) {
            console.error(err);
            return sendJson(res, 500, {ok:false, message:"Database error."});
        }

        const updateQuery = `UPDATE posts SET dislikes = dislikes + 1 WHERE p_id = ?`;

        connection.query(updateQuery, [postId], function(qerr) {
            if (qerr) {
                connection.release();
                console.error(qerr);
                return sendJson(res, 500, {ok:false, message:"Dislike failed."});
            }

            const selectQuery = `SELECT dislikes FROM posts WHERE p_id = ?`;
            connection.query(selectQuery, [postId], function(err2, rows) {
                connection.release();
                if (err2) {
                    console.error(err2);
                    return sendJson(res, 500, {ok:false, message:"Database error."});
                }

                return sendJson(res, 200, {
                    ok: true,
                    dislikes: rows[0].dislikes
                });
            });
        });
    });
});

module.exports = router;
