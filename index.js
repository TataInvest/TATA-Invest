import express from 'express';
import admin from 'firebase-admin'; // Using firebase@9
import cron from 'node-cron';
import moment from 'moment';
import cors from 'cors';
import morgan from 'morgan';
import parentReferralRoutes from './routes/parentReferralRoutes.js';
import dotenv from 'dotenv';
import path from 'path';
import { getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './config/config.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { log } from 'console';
import { CronJob } from 'cron';
import formData from 'form-data';
import Mailgun from 'mailgun.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Initialize Firebase Admin SDK with service account credentials (replace with your actual values)
admin.initializeApp({
  credential: admin.credential.cert({
    "type": process.env.TYPE,
    "project_id": process.env.PROJECT_ID,
    "private_key_id": process.env.PRIVATE_KEY_ID,
    "private_key": process.env.PRIVATE_KEY,
    "client_email": process.env.CLIENT_EMAIL,
    "client_id": process.env.CLIENT_ID,
    "auth_uri": process.env.AUTH_URI,
    "token_uri": process.env.TOKEN_URI,
    "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
    "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL,
    "universe_domain": process.env.UNIVERSE_DOMAIN
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

const firestore = admin.firestore();


// Replace these with your Mailjet API credentials
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
  public_key: process.env.MAILGUN_PUBLIC_KEY
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// app.use("/api", parentReferralRoutes);
app.get("/api/parentReferralUpdate/:id", async (req, res) => {
  console.log("Entered Server");
  const childrenId = req.params.id;

  try {
    console.log("Children ID in try block: ", childrenId);
    const childRef = await getDoc(doc(db, 'users', childrenId));

    if (!childRef.exists()) {
      return res.status(404).send({
        success: false,
        message: "Child not found",
      });
    }

    const childData = childRef.data();
    const parentReferralCode = childData.parentReferralCode;
    console.log("Parent Referral Code in try block: ", parentReferralCode);

    console.log("Parent Referral Code in try block: ", parentReferralCode);
    const parentRef = doc(db, 'users', parentReferralCode);
    const parentRefGet = await getDoc(parentRef);

    if (parentRefGet.exists()) {
      const parentData = parentRefGet.data();
      const referralUsersArray = parentData.referralUsers || [];

      // Check if the child is already in the referral users array
      if (!referralUsersArray.includes(childrenId)) {
        referralUsersArray.push(childrenId);
        // Update the parent document in Firestore with the updated referral users array
        await parentRef.update({
          referralUsers: referralUsersArray
        });
      }

      const dummyData = {
        name: "John Doe",
        email: "tata.com",
        // nameNew: parentData.name
      };

      return res.status(200).send({
        success: true,
        message: "Demo message",
        dummyData
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Parent not found",
      });
    }
  } catch (error) {
    console.error(error);
    // Check if the error is due to permission denied
    if (error.code === 'permission-denied') {
      return res.status(403).send({
        success: false,
        message: "Permission denied to access Firestore"
      });
    } else {
      return res.status(500).send({
        success: false,
        message: "Error updating referral array",
        error: error.message // Include the error message for debugging purposes
      });
    }
  }
});


app.get("/api/getAllUsers", async (req, res) => {
  const usersRef = firestore.collection('users');
  const snapshot = await usersRef.get();
  const users = snapshot.docs.map(doc => doc.data());
  res.json(users);
});
app.get("/api/getUserDetails/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log("single user id", userId);
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userSnap.data();
    res.status(200).json({ user: userData, message: "User details fetched successfully" });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/api/getAllPaymentRequests", async (req, res) => {
  try {
    const usersRef = firestore.collection('paymentApprovalRequests');
    const snapshot = await usersRef.get();
    const users = snapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() }; // Include document ID in the response
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching payment requests:', error);
    res.status(500).json({ error: 'Error fetching payment requests' });
  }
});

app.get("/api/getAllKYCRequests", async (req, res) => {
  try {
    const kycsRef = firestore.collection('KYCApprovalRequests');
    const snapshot = await kycsRef.get();
    const kycs = snapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() }; // Include document ID in the response
    });
    res.json(kycs);
  } catch (error) {
    console.error('Error fetching KYC requests:', error);
    res.status(500).json({ error: 'Error fetching KYC requests' });
  }
});
app.get("/api/getAllWithdrawalRequests", async (req, res) => {
  try {
    const usersRef = firestore.collection('withdrawalApprovalRequests');
    const snapshot = await usersRef.get();
    const users = snapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() }; // Include document ID in the response
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({ error: 'Error fetching withdrawal requests' });
  }
});




app.get('/api/sendotp/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const phoneNumber = Number(id.slice(0, 10));
    const otpNumber = id.slice(10);

    const apiKey = process.env.FAST2SMS_API_KEY; // Replace 'YOUR_API_KEY' with your Fast2SMS API key
    const smsData = {
      // sender_id: 'FSTSMS',
      // message: 'This is your OTP',
      variables_values: otpNumber,
      // language: 'english',
      route: 'otp',
      numbers: phoneNumber // Replace with the recipient's phone number
    };

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': `${apiKey}`, // Update header key to 'Authorization' and add 'Bearer' prefix
        'Content-Type': 'application/json' // Set content type to 'application/json'
      },
      body: JSON.stringify(smsData) // Convert smsData to JSON string
    });

    const responseData = await response.json();
    console.log('Response data', responseData.data);
    res.status(200).json(responseData);

    // res.status(200).json({"phoneNumber:": phoneNumber , "OTP:": otpNumber}); // Send response data back to client
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' }); // Send error response
  }
});

// Route to send email
app.get('/api/send-email-kyc/:id', async (req, res) => {
  try {
    const userEmail = req.params.id;

    await mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: userEmail,
        subject: 'KYC Request Sent!!!',
        html: `<h3>Dear user,</h3>
               <p>We are writing to inform you that your Know Your Customer (KYC) process has been sent to the admin for verification. We will let you know about it as soon as possible.</p>
               <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
               <p>Thank you for your cooperation during the KYC process. We value your trust and continued partnership.</p>
               <p>Regards,</p>
               <p>Tata Invest Team</p>`,
      })
      .then(msg => console.log(msg)) // success
      .catch(err => console.log(err)); // fail;
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.get('/api/send-email-kyc-accepted/:id', async (req, res) => {
  try {
    const userEmail = req.params.id;

    await mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: userEmail,
        subject: 'KYC Approval Accepted!!!',
        html: `<h3>Dear user,</h3>
               <p>We are writing to inform you that your Know Your Customer (KYC) process has been accepted successfully. As a result, you now have authorization to withdraw funds from your account at your own discretion.</p>
               <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
               <p>Thank you for your cooperation during the KYC process. We value your trust and continued partnership.</p>
               <p>Regards,</p>
               <p>Tata Invest Team</p>`,
      })
      .then(msg => console.log(msg)) // success
      .catch(err => console.log(err)); // fail;
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.get('/api/send-email-kyc-rejected/:id', async (req, res) => {
  try {
    const userEmail = req.params.id;

    await mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: userEmail,
        subject: 'KYC Request Rejected!!!',
        html: `<h3>Dear user,</h3>
               <p>We are writing to inform you that your Know Your Customer (KYC) request has been rejected due to some discrepancy in the submitted data such as PAN card, Aadhaar card, bank account details, etc.</p>
               <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
               <p>Thank you for your cooperation during the KYC process. We value your trust and continued partnership.</p>
               <p>Regards,</p>
               <p>Tata Invest Team</p>`,
      })
      .then(msg => console.log(msg)) // success
      .catch(err => console.log(err)); // fail;
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});
// Route to send email
app.post('/send-email-withdrawal', async (req, res) => {
  try {
    const { email, withdrawalAmount, accountNumber, ifscCode, name } = req.body;
    const emailContent = `
      <p>Hi ${name},</p>
      <p>Your withdrawal request has been sent successfully. Kepp checking your statement section for any furthur change in status. We will notify you as soon as you request has been accepted.</p>
      <ul>
        <li>Withdrawal Amount: ${withdrawalAmount}</li>
        <li>Account Number: ${accountNumber}</li>
        <li>IFSC Code: ${ifscCode}</li>
        <li>Status : pending</li>
      </ul>
      <p>Thank you for using our services!</p>
      <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
      <p>Regards,
      </p>
      <p>Tata Invest Team</p>
      <
    `;

    mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: email,
        subject: 'Withdrawal Approval Request Generated',
        html: emailContent
      })
      .then(msg => {
        console.log(msg); // Success
        res.status(200).json({ message: 'Email sent successfully' });
      })
      .catch(err => {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email' });
      });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});
app.post('/send-email-withdrawal-accepted', async (req, res) => {
  try {
    const { email, withdrawalAmount, name } = req.body;
    const emailContent = `
      <p>Hi ${name},</p>
      <p>Your withdrawal request has been accepted. You can go ahead abd verify your withdrawal balance and entered amount.</p>
      <ul>
        <li>Withdrawal Amount: ${withdrawalAmount}</li>
        <li>Status : <span style={{color:'green'}}>accepted</span></li>
      </ul>
      <p>Thank you for using our services!</p>
      <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
      <p>Regards,
      </p>
      <p>Tata Invest Team</p>
      <
    `;

    mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: email,
        subject: 'Withdrawal Request Processed',
        html: emailContent
      })
      .then(msg => {
        console.log(msg); // Success
        res.status(200).json({ message: 'Email sent successfully' });
      })
      .catch(err => {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email' });
      });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});
app.post('/send-email-withdrawal-rejected', async (req, res) => {
  try {
    const { email, withdrawalAmount, name } = req.body;
    const emailContent = `
      <p>Hi ${name},</p>
      <p>Your withdrawal request has been rejected. If you find any discrepency you can go ahead put another request and if it persists contact us through our support email.</p>
      <ul>
        <li>Withdrawal Amount: ${withdrawalAmount}</li>
        <li>Status : <span style={{color:'red'}}>rejected</span></li>
      </ul>
      <p>Thank you for using our services!</p>
      <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
      <p>Regards,
      </p>
      <p>Tata Invest Team</p>
      <
    `;

    mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: email,
        subject: 'Withdrawal Request Rejected',
        html: emailContent
      })
      .then(msg => {
        console.log(msg); // Success
        res.status(200).json({ message: 'Email sent successfully' });
      })
      .catch(err => {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email' });
      });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/send-email-addmoney', async (req, res) => {
  try {
    const { email, paidAmount, utrNumber, name } = req.body;
    const emailContent = `
      <p>Hi ${name},</p>
      <p>Your payment approval request has been sent successfully. Keep checking your statement section for any furthur change in status. We will notify you as soon as you request has been accepted.</p>
      <ul>
        <li>Paid Amount: ${paidAmount}</li>
        <li>UTR Number: ${utrNumber}</li>
        <li>Status : pending</li>
      </ul>
      <p>Thank you for using our services!</p>
      <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
      <p>Regards,
      </p>
      <p>Tata Invest Team</p>
      <
    `;

    mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: email,
        subject: 'Payment Approval Request Generated',
        html: emailContent
      })
      .then(msg => {
        console.log(msg); // Success
        res.status(200).json({ message: 'Email sent successfully' });
      })
      .catch(err => {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email' });
      });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});
app.post('/send-email-addmoney-accepted', async (req, res) => {
  try {
    const { email, paidAmount, name, investedAmount } = req.body;
    const emailContent = `
      <p>Hi ${name},</p>
      <p>Your payment approval request has been accepted. You can go ahead abd verify your account balance.</p>
      <ul>
        <li>Paid Amount: ${paidAmount}</li>
        <li>Status : <span style={{color:'green'}}>accepted</span></li>
        <li> Invested Amount : ${investedAmount} (as of now)</li>
      </ul>
      <p>Thank you for using our services!</p>
      <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
      <p>Regards,
      </p>
      <p>Tata Invest Team</p>
      <
    `;

    mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: email,
        subject: 'Payment Approval Request Accepted',
        html: emailContent
      })
      .then(msg => {
        console.log(msg); // Success
        res.status(200).json({ message: 'Email sent successfully' });
      })
      .catch(err => {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email' });
      });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});
app.post('/send-email-addmoney-rejected', async (req, res) => {
  try {
    const { email, paidAmount, name, investedAmount } = req.body;
    const emailContent = `
      <p>Hi ${name},</p>
      <p>Your payment approval request has been rejected. If you find any discrepency you can go ahead put another request and if it persists contact us through our support email.</p>
      <ul>
        <li>Paid Amount: ${paidAmount}</li>
        <li>Status : <span style={{color:'red'}}>rejected</span></li>
        <li> Invested Amount : ${investedAmount} (as of now)</li>
      </ul>
      <p>Thank you for using our services!</p>
      <p>For any inquiries or assistance, please contact our customer support team at relations@tatainvest.org.</p>
      <p>Regards,
      </p>
      <p>Tata Invest Team</p>
      <
    `;

    mg.messages
      .create('tatainvest.org', {
        from: 'relations@tatainvest.org',
        to: email,
        subject: 'Payment Approval Request Rejected',
        html: emailContent
      })
      .then(msg => {
        console.log(msg); // Success
        res.status(200).json({ message: 'Email sent successfully' });
      })
      .catch(err => {
        console.error('Error sending email:', err);
        res.status(500).json({ error: 'Failed to send email' });
      });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Serve static assets in production
app.use(express.static(path.join(__dirname, "./client/build")));

app.get("*", function (req, res) {
  res.sendFile(path.join(__dirname, "./client/build/index.html"));
});


app.get('/', (req, res) => {
  res.send('Server service running');
});


// Start the server with Nodemon for automatic restarts during development
app.listen(port, () => console.log(`Server listening on port ${port}`));
