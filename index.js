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
    "postgres://invoice_system_db_user:6vTelxmjfHXlSsngFMMv1jgriP3QRas3@dpg-cle2018lccns73ade9og-a.singapore-postgres.render.com/invoice_system_db?ssl=true",
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
  service: "Outlook365",
  host: "smtp.office365.com",
  port: "587",
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false,
  },
  auth: {
    user: 'accounts@looktall.xyz',
    pass: 'Xok88060abc'
  },
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

app.get('/user/get/', verifyToken, async (req, res) => {

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 15;

  client.query("SELECT * FROM users")
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
    client.query("INSERT INTO vendors (vendor_name, company_name, address, email, contact_no, created_by) VALUES ($1, $2, $3, $4, $5, $6)", [req.body.vendorName, req.body.companyName, req.body.address, req.body.email, req.body.contactNo, req.user.userId])
          .then((result) => {
              res.status(201).send("Register Success");
          })
          .catch((e) => {
              console.error(e.stack);
              res.status(500).send(e.stack);
          })
});

app.post('/vendor/edit/:id', async (req, res) => {
  client.query("UPDATE vendors SET vendor_name = $1, company_name = $2, address = $3, email = $4, contact_no = $5 WHERE id = $6", [req.body.vendorName, req.body.companyName, req.body.address, req.body.email, req.body.contactNo, result.params.id])
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
  const vendorName = req.query.vendorName || null;

  client.query("SELECT * FROM invoices")
        .then((result) => {

          if(vendorName != null)
          {
            result.rows = result.rows.filter(item => item.name === vendorName);
          }

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
  client.query("INSERT INTO invoices (recipient, item_list, total) VALUES ($1, $2, $3)", [req.body.recipient, req.body.item_list, req.body.total])
        .then((result) => {
            res.status(201).send("Invoice Created");
        })
        .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
        })
});

app.post('/invoice/edit/:id', async (req, res) => {
  client.query("UPDATE invoices SET recipient = $1, item_list = $2,  total = $3 WHERE id = $4", [req.body.recipient, req.body.item_list, req.body.total, result.params.id])
        .then((result) => {
            res.status(201).send("Invoice Update Success");
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