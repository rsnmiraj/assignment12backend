let express = require("express")
let cors = require("cors")
 let app = express();
 const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
app.use(cors())
app.use(express.json())
let port = process.env.PORT || 5001;
let { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

let uri = "mongodb+srv://raihanmiraj:Bangladesh123@cluster0.dhnvk0f.mongodb.net/?retryWrites=true&w=majority";
let users = []; 
let client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("summercampschool").command({ ping: 1 });
    let database = client.db("summercampschool");
    let classes = database.collection("classes")
    let enrolledClasses = database.collection("enrolledclasses")
    const usersCollection = database.collection("users");
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })
    app.get('/email', verifyJWT, async (req, res) => {
        console.log(req.decoded)
      res.send(req.decoded.email );
    })
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
    //   const result = await usersCollection.find().toArray();
    //   res.send(result);
    // });

// payment 

    // create payment intent


    app.get("/class/:classid", async (req, res) => {
      let toyid = req.params.classid
      let cursor = classes.findOne({ _id: new ObjectId(toyid) });
      let result = await cursor
      res.send(result)
    })


    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    // payment related api
    app.post('/payments', async (req, res) => {
      const data = req.body;
       const filter = {email:data.email ,  classid: data.classid };
      const updateDoc = {
        $set: {
          transactionId: data.transactionId,
          price:data.price,
          date: data.date, 
        enrolled:true
        },
      };

      const result = await enrolledClasses.updateOne(filter, updateDoc);
      res.send(result);
    })





    app.get('/addnow', async(req, res) =>{
      const pipeline =[
        {
          '$lookup': {
            'from': 'classes', 
            'localField': 'classid', 
            'foreignField': '_id', 
            'as': 'result'
          }
        }
      ]

      const result = await enrolledClasses.aggregate(pipeline).toArray()
      res.send(result)

    })



    app.get('/users',  async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get('/selectedclass/:email', async (req, res) => {
      let email = req.params.email
      let cursor = enrolledClasses.find({ email: email, enrolled:false});
      let result = await cursor.toArray();
      const resultClassidarray = result.map(e=>new ObjectId(e.classid))
    const resultclassses = await classes.find({ _id: { $in:resultClassidarray } }).toArray();
      res.send(resultclassses);

    });
    
    app.delete('/selectedclass/delete/:id/:email', async (req, res) => {
           let deleteId = req.params.id
           let email = req.params.email
      let query = {
        classid: deleteId,
        email:email

      }
      let deleteData = await enrolledClasses.deleteOne(query);
      if (deleteData.deletedCount == 1) {
           res.send("Succesfully Deleted")
      } else {
        res.send(" Deleted Failed")

      }

    });
 
    app.post("/select/class/", async (req, res) => {
      let data = { ...req.body }; 
      const query = { classid:new ObjectId(data.classid)  , email:data.email}
      const existingData = await enrolledClasses.findOne(query);

      if (existingData) {
        return res.send({ message: 'exist' })
      }
      data['classid'] = new ObjectId(data.classid)
     let result = await enrolledClasses.insertOne(data)
      res.send(JSON.stringify(result))
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.post("/addclass", async (req, res) => {
      let data = { ...req.body }; 
     let result = await classes.insertOne(data)
      res.send(JSON.stringify(result))
    })

    app.get("/classes/find/:email", async (req, res) => {
      let cursor = classes.find({ instructoremail: req.params.email });
      let result = await cursor.toArray();
      res.send(result);

    });

    app.get("/classes/all", async (req, res) => { 
       let cursor = classes.find();
      let result = await cursor.toArray();
      res.send(result);

    });
    app.get("/instructor/all", async (req, res) => { 
       let cursor = usersCollection.find({ role: "instructor" });
      let result = await cursor.toArray();
      res.send(result);

    });
    app.get("/popularclasses", async (req, res) => { 
      let cursor = classes.find().sort({ enrolledstudents: -1 });
      let result = await cursor.limit(6).toArray();
      res.send(result);
 
  });

    app.get("/class/:classid", async (req, res) => {
      let toyid = req.params.classid
      let cursor = classes.findOne({ _id: new ObjectId(toyid) });
      let result = await cursor
      res.send(result)
    })

    
    app.put("/class/update/:id", async (req, res) => {
      let updateId = req.params.id
      let filter = {
        _id: new ObjectId(updateId)
      }
      let options = { upsert: true };
      let updateDoc = {
        $set: {
          ...req.body
        },
      };
      let result = await classes.updateOne(filter, updateDoc, options);
      res.send(JSON.stringify(result))
    })

    app.put("/class/approved/:id", async (req, res) => {
      let updateId = req.params.id
      let filter = {
        _id: new ObjectId(updateId)
      }
      let options = { upsert: true };
      let updateDoc = {
        $set: {
          status:'approved'
        },
      };
      let result = await classes.updateOne(filter, updateDoc, options);
      res.send(JSON.stringify(result))
    })

    app.put("/class/denied/:id", async (req, res) => {
      let updateId = req.params.id
      let filter = {
        _id: new ObjectId(updateId)
      }
      let options = { upsert: true };
      let updateDoc = {
        $set: {
          status:'denied'
        },
      };
      let result = await classes.updateOne(filter, updateDoc, options);
      res.send(JSON.stringify(result))
    })
    app.put("/class/pending/:id", async (req, res) => {
      let updateId = req.params.id
      let filter = {
        _id: new ObjectId(updateId)
      }
      let options = { upsert: true };
      let updateDoc = {
        $set: {
          status:'pending'
        },
      };
      let result = await classes.updateOne(filter, updateDoc, options);
      res.send(JSON.stringify(result))
    })

    app.put("/class/feedback/:id", async (req, res) => {
     let feedback = req.body.feedback;
     let updateId = req.params.id
     let filter = {
       _id: new ObjectId(updateId)
     }
     let options = { upsert: true };
     let updateDoc = {
       $set: {
        feedback:feedback
       },
     };
     let result = await classes.updateOne(filter, updateDoc, options);
     res.send(JSON.stringify(result))
    })


//     app.get("/search/:search", async (req, res) => {
//       let cursor = classes.find({
//         toyname:
//           { $regex: req.params.search, $options: "i" }
//       });
//       let result = await cursor.toArray();
//       res.send(result);

//     });

    

//     app.get("/class/:limit", async (req, res) => {
//       let cursor = classes.find();
//       let result = await cursor.limit(parseInt(req.params.limit)).toArray();
//       res.send(result);

//     });

 

   

// app.delete("/delete/:id", async (req, res) => {

//       let deleteId = req.params.id
//       let query = {
//         _id: new ObjectId(deleteId)
//       }

//       let deleteData = await classes.deleteOne(query);
//       if (deleteData.deletedCount == 1) {
//         let indexToDelete = users.findIndex(item => item._id == deleteId);
//         if (indexToDelete > -1) {
//           users.splice(indexToDelete, 1);
//         }
//         res.send("Succesfully Deleted")
//       } else {
//         res.send(" Deleted Failed")

//       }

//     })


 
 

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);









app.get("/", (req, res) => {
  res.send("user server running")
})


app.listen(port, () => {
  console.log(`server is running on port ${port}`)
})