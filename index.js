const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
const PORT = process.env.PORT || 8081;
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require('dotenv').config();

const config = {
  connectionString:
    "postgres://gameportal_db_user:TnJdfCS9gNV1j1P19fsGp2H14t6qkf1N@dpg-cjrcte61208c73bkhro0-a.singapore-postgres.render.com/gameportal_db?ssl=true",
};

const { Client } = require('pg');
const { constants } = require("buffer");
const client = new Client(config);
client.connect()

app.use(cors())
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit:50000 }));

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});

var transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: 'accounts@looktall.xyz',
      pass: 'Xok88060abc'
    }
});
  
function SendInvoice()
{
    var mailOptions = {
        from: 'accounts@looktall.xyz',
        to: 'chinkeongtan96@gmail.com',
        subject: 'subject',
        html: 'html'
    };
    
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

function GenerateJWT(_userId, _username, _user_type)
{
  return jwt.sign(
      { userId: _userId, username: _username, user_type: _user_type},
      process.env.TOKEN_KEY,
      { expiresIn: "24h" }
    );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.TOKEN_KEY, (err, user) =>
    {
      if (err)
      {
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  }
  else
  {
    res.sendStatus(401);
  }
}

app.get('/', async (req, res) => {
  res.status(200).send("OK");
})

//USER Login + CRUD

app.post('/user/login', async (req, res) => {

  if( typeof(req.body.username) == 'undefined' || typeof(req.body.password) == 'undefined')
  {
    return res.status(500).send("Error: Please enter your username and password to login.");
  }

  client.query("SELECT * FROM users WHERE username = $1 AND password = crypt($2, password)", [req.body.username, req.body.password])
        .then((result) => {
          if(result.rows.length > 0)
          {
            const token = GenerateJWT(result.rows[0].id, result.rows[0].username, result.rows[0].user_type);

            client.query("UPDATE users SET last_login = NOW() WHERE id = $1", [result.rows[0].id])

            res.status(200).json({
                success: true,
                data: {
                  userId: result.rows[0].id,
                  token: token,
                },
              });
          }
          else
          {
            res.status(500).send("Error: Wrong Username or Password");
          }
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.post('/user/create', async (req, res) => {

  if( typeof(req.body.username) == 'undefined' || typeof(req.body.password) == 'undefined')
  {
    return res.status(500).send("Error: Please fill in your username and password to complete the registration process.");
  }

  client.query("SELECT * FROM users WHERE username = $1", [req.body.username])
        .then((result) => {
            if(result.rows.length > 0)
            {
              if(req.body.username == result.rows[0].username)
                return res.status(500).send("Error: username has been taken");
            }
            else
            {
              client.query("INSERT INTO users (username, password) VALUES ($1, crypt($2, gen_salt('bf')))", [req.body.username, req.body.password])
                    .then((result) => {
                      res.status(201).send("Register Success");
                    })
                    .catch((e) => {
                      console.error(e.stack);
                      res.status(500).send(e.stack);
                    })
            }
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})


//#region Vendor
app.get('/vendor/get/', verifyToken, async (req, res) => {

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 15;

    client.query("SELECT * FROM vendors")
          .then((result) => {
            const startIndex = (page - 1) * pageSize;
            const endIndex = page * pageSize;
            const paginatedItems = result.rows.slice(startIndex, endIndex);

            res.json({
              page,
              pageSize,
              totalItems: result.rows.length,
              totalPages: Math.ceil(result.rows.length / pageSize),
              items: paginatedItems,
            });
          })
          .catch((e) => {
                console.error(e.stack);
                res.status(500).send(e.stack);
          })
})

app.get('/vendor/get/:id', verifyToken, async (req, res) => {

    client.query("SELECT * FROM vendors WHERE id = $1", [req.params.id])
          .then((result) => {
                if(result.rowCount <= 0)
                    res.status(500).send("vendor doesnt exist");
                else
                    res.send(JSON.stringify(result.rows[0]));
          })
          .catch((e) => {
                console.error(e.stack);
                res.status(500).send(e.stack);
          })
})

app.post('/vendor/create', async (req, res) => {
    client.query("INSERT INTO vendors (name, email) VALUES ($1, $2)", [req.body.name, req.body.email])
          .then((result) => {
              res.status(201).send("Register Success");
          })
          .catch((e) => {
              console.error(e.stack);
              res.status(500).send(e.stack);
          })
});

app.post('/vendor/edit/:id', async (req, res) => {
  client.query("UPDATE vendors SET name = $1, email = $2 WHERE id = $3", [req.body.name, req.body.email, result.params.id])
        .then((result) => {
            res.status(201).send("Vendor Update Success");
        })
        .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
        })
});

app.post('/vendor/delete/:id', async (req, res) => {
  client.query("UPDATE vendors SET deleted_at = NOW() WHERE id = $1", [req.params.id])
        .then((result) => {
            res.status(201).send("Vendor Deleted");
        })
        .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
        })
});

//#endregion

//#region Invoice
app.get('/invoice/get/', verifyToken, async (req, res) => {

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 15;
  const vendorName = req.query.vendorName || "*";

  client.query("SELECT * FROM invoices WHERE vendorName = $1", [vendorName])
        .then((result) => {

          const startIndex = (page - 1) * pageSize;
          const endIndex = page * pageSize;
          const paginatedItems = result.rows.slice(startIndex, endIndex);

          res.json({
            page,
            pageSize,
            totalItems: result.rows.length,
            totalPages: Math.ceil(result.rows.length / pageSize),
            items: paginatedItems,
          });
        })
        .catch((e) => {
              console.error(e.stack);
              res.status(500).send(e.stack);
        })
})

app.get('/invoice/get/:id', verifyToken, async (req, res) => {

  client.query("SELECT * FROM invoices WHERE id = $1", [req.params.id])
        .then((result) => {
              if(result.rowCount <= 0)
                  res.status(500).send("Invoice doesnt exist");
              else
                  res.send(JSON.stringify(result.rows[0]));
        })
        .catch((e) => {
              console.error(e.stack);
              res.status(500).send(e.stack);
        })
})

app.post('/invoice/create', async (req, res) => {
  client.query("INSERT INTO invoices (name, email) VALUES ($1, $2)", [req.body.name, req.body.email])
        .then((result) => {
            res.status(201).send("Invoice Created");
        })
        .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
        })
});

app.post('/invoice/edit/:id', async (req, res) => {
  client.query("UPDATE invoices SET name = $1, email = $2 WHERE id = $3", [req.body.name, req.body.email, result.params.id])
        .then((result) => {
            res.status(201).send("Vendor Update Success");
        })
        .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
        })
});

app.post('/invoice/delete/:id', async (req, res) => {
  client.query("UPDATE invoice SET deleted_at = NOW() WHERE id = $1", [req.params.id])
        .then((result) => {
            res.status(201).send("Invoice Deleted");
        })
        .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
        })
});
//#endregion

SendInvoice();