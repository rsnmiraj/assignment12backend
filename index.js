let express = require("express")
let cors = require("cors")
 let app = express();
 const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')('sk_test_51NI4RwCkH9R2r5PW06AmLRwuim02GwWq7T4HFSa7309zcNHGlPW8Z6AJqVZW3TEcUiMUG02RzDgfEklZA9Sg49Yo00IXWhEUAX')
app.use(cors())
app.use(express.json())
let port = process.env.PORT || 5000;
let { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.get('/hello', async (req, res) => {
 
res.send("hello" );
})

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, 'dafea91334ce03e49042a919e62de4bd212fc5d3c5c1e08656122279bb16bbadca7be7506441ff2e209f59235ab8dc4eb21ee5ae96d9816168c68e22ed9247d9', (err, decoded) => {
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
        return res.send({ message: 'user already exists', data:existingUser })
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
    app.post('/payments/:id', async (req, res) => {
      let id = req.params.id
      const data = req.body;
       const filter = {_id:new ObjectId(id)};
      const updateDoc = {
        $set: {
          transactionId: data.transactionId,
          price:data.price,
          date: data.date, 
        enrolled:true
        },
      };

      const result = await enrolledClasses.updateOne(filter, updateDoc);

      let enrolledClassesFIndbyid  =await enrolledClasses.findOne({ _id: new ObjectId(req.params.id) });
      let classid = enrolledClassesFIndbyid.classid
      
           let findClassdetails  =await classes.findOne({ _id: new ObjectId(classid) });
let availableseat = findClassdetails.availableseat-1 ;
let enrolledstudents = findClassdetails.enrolledstudents+1 ;
let _id = findClassdetails._id ;
const filter2 = {_id:new ObjectId(_id)};
const updateDoc2 = {
  $set: {
    availableseat:availableseat,
    enrolledstudents:enrolledstudents,   
  },
};

const result2 = await classes.updateOne(filter2, updateDoc2);


      res.send(result2);
    })
//     app.get('/paymentstest/:id', async (req, res) => {
//       let enrolledClassesFIndbyid  =await enrolledClasses.findOne({ _id: new ObjectId(req.params.id) });
//  let classid = enrolledClassesFIndbyid.classid
 
//       let findClassdetails  =await classes.findOne({ _id: new ObjectId(classid) });
//       res.send(findClassdetails)
//     })


    app.get('/enrolledclasses/:email', async(req, res) =>{
      let email = req.params.email
      const pipeline = [
        {
          $match: {
            email: email,
            enrolled:true
          }
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classid',
            foreignField: '_id',
            as: 'result'
          }
        }
      ];
      
      const result = await enrolledClasses.aggregate(pipeline).toArray();
      res.send(result);
      
    })

    app.get('/addnow', async(req, res) =>{
      const pipeline =[
        
        {
          $match: {
            email: "rsnmiraj@gmail.com"
          },
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
      const pipeline = [
        {
          $match: {
            email: email,
            enrolled:false
          }
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classid',
            foreignField: '_id',
            as: 'result'
          }
        }
      ];
      
      const result = await enrolledClasses.aggregate(pipeline).toArray();
      res.send(result);

    });
    
    app.delete('/selectedclass/delete/:id', async (req, res) => {
           let deleteId = req.params.id
           let email = req.params.email
      let query = {
        _id: new ObjectId(deleteId),
       

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
       let cursor = classes.find({status:'approved'});
      let result = await cursor.toArray();
      res.send(result);

    });
    app.get("/admin/classes/all", async (req, res) => { 
       let cursor = classes.find();
      let result = await cursor.toArray();
      res.send(result);

    });
    app.get("/instructor/all", async (req, res) => { 
       let cursor = usersCollection.find({ role: "instructor" });
      let result = await cursor.limit(6).toArray()
      res.send(result);

    });
    app.get("/popularclasses", async (req, res) => { 
      let cursor = classes.find().sort({ enrolledstudents: -1 });
      let result = await cursor.limit(6).toArray();
      res.send(result);
 
  });

  app.get("/paymenthistory/:email", async (req, res) => { 
    
    let email = req.params.email
      const pipeline = [
        {
          $match: {
            email:req.params.email,
            enrolled:true
          }
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classid',
            foreignField: '_id',
            as: 'result'
          }
        },
        {
          $sort: {
            // Specify the field to sort by (assuming 'createdAt' field for example)
            'result._id': -1
          }
        }
      ];
      
      const result = await enrolledClasses.aggregate(pipeline).toArray();
      res.send(result);

});


  app.get("/popularinstructor", async (req, res) => { 
    let cursor = usersCollection.find({role:'instructor'});
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