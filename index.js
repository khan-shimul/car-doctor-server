const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());


// middle ware
const logger = async (req, res, next) => {
  console.log('Called:', req.hostname, req.originalUrl );
  next();
};

// Middleware - verify token
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'Unauthorized Access'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if(error){
      return res.status(401).send({message: 'Unauthorized Access'})
    }
    req.user = decoded
    next()
  })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.up5eg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('booking');

    // Auth related api
    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV == 'production',
        sameSite: 'strict'
      })
      .send({success: true})
    });

    // Services related api
    app.get('/services', logger, async(req, res) => {
        const cursor = serviceCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    });

    // get single data api
    app.get('/services/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const options = {
        // Include only the `title` and `imdb` fields in the returned document
        projection: { title: 1, price: 1, img:1, service_id: 1, description: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // Bookings related Api's
    app.post('/booking', async(req, res) => {
      const booking = req.body;
      console.log(booking)
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get('/booking', verifyToken, async(req, res) => {
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'Forbidden Access'})
      }
      let query = {};
      if(req.query?.email){
        query={email: req.query.email}
      }
      const result = await bookingCollection.find(query).toArray();
      
      res.send(result)
    });

    app.patch('/booking/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId (id)};
      const updatedBooking = req.body;
      const updateBookingDoc = {
        $set: {
          status: updatedBooking.status
        },
      };
      const result = await bookingCollection.updateOne(filter, updateBookingDoc);
      res.send(result);
    })

    app.delete('/booking/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Doctor server is running')
});
app.listen(port, ()=> {
    console.log(`Doctor server is running on port ${port}`)
})