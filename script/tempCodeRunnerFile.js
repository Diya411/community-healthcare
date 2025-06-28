/*
// Connect to MongoDB
const uri = "mongodb+srv://chcare18:chcare18@communityhealthcare.gsoni.mongodb.net/CommunityHealthCare?retryWrites=true&w=majority&appName=CommunityHealthCare";

// OpenCage Geocoding API key
const OPEN_CAGE_API_KEY = 'b3dc920cbc244540824cb96dba0a8dc8'; 
*/
const https = require('https'); // Built-in https module
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const port = 3000;

// OpenCage Geocoding API key
const OPEN_CAGE_API_KEY = 'b3dc920cbc244540824cb96dba0a8dc8';

// Middleware to parse JSON data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (like index.html)
app.use(express.static(path.join(__dirname, 'public'))); // Adjust the path if necessary

// Serve JavaScript files from the scripts directory (for internal usage, not for client-side)
app.use('/scripts', express.static(path.join(__dirname)));  // Serve static JavaScript files from the scripts folder

// Connect to MongoDB Atlas
const uri =
	'mongodb+srv://chcare18:chcare18@communityhealthcare.gsoni.mongodb.net/CommunityHealthCare?retryWrites=true&w=majority&appName=CommunityHealthCare';
mongoose
	.connect(uri)
	.then(() => console.log('Connected to MongoDB Atlas'))
	.catch((err) => console.error('MongoDB connection error:', err));

// Define a schema for the symptoms
const symptomSchema = new mongoose.Schema({
	name: String,
	email: String,
	phone: String,
	countryCode: String,
	gender: String,
	address: String,
	pincode: String,
	commonSymptoms: [String],
	detailedSymptoms: String,
	severity: String,
});

// Create a model for the symptoms
const Symptom = mongoose.model('Symptom', symptomSchema);

// Route for the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html')); // Serve index.html if needed
});

// Route for the map page
app.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'map.html')); // Serve map.html from the public folder
});


// API endpoint to submit symptoms
app.post('/api/symptoms', async (req, res) => {
	try {
		const symptomData = req.body;
		const symptom = new Symptom(symptomData);
		await symptom.save();
		res.status(201).send({ message: 'Symptom data saved successfully!' });
	} catch (error) {
		console.error('Error saving symptoms:', error);
		res.status(500).send({ message: 'Error submitting symptoms' });
	}
});

const httpsGetPromise = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk));
      response.on('end', () => resolve(JSON.parse(data)));
    }).on('error', (error) => reject(error));
  });

app.get('/api/locations', async (req, res) => {
  try {
    const locations = await Symptom.find({}, 'pincode commonSymptoms detailedSymptoms');
    const locationData = await Promise.all(
      locations.map(async (location) => {
        const { pincode, commonSymptoms, detailedSymptoms } = location;
        if (pincode) {
          const url = `https://api.opencagedata.com/geocode/v1/json?q=${pincode}&key=${OPEN_CAGE_API_KEY}&countrycode=in`;
          const data = await httpsGetPromise(url);
          if (data.results.length > 0) {
            const { lat, lng } = data.results[0].geometry;
            return {
              pincode,
              latitude: lat,
              longitude: lng,
              commonSymptoms,
              detailedSymptoms,
            };
          }
        }
      })
    );
    res.json(locationData.filter(Boolean));
  } catch (error) {
    console.error('Error fetching location data:', error);
    res.status(500).send({ message: 'Error fetching location data' });
  }
});

// API endpoint to fetch locations and convert pincodes to lat/lng
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await Symptom.find({}, 'pincode commonSymptoms detailedSymptoms'); // Ensure you're fetching commonSymptoms and detailedSymptoms too
    const locationData = [];

    for (const location of locations) {
      const pincode = location.pincode;
      const commonSymptoms = location.commonSymptoms;
      const detailedSymptoms = location.detailedSymptoms;
      
      // Logging the data to ensure it's correct
      //console.log(`Location Data: Pincode: ${pincode}, Common Symptoms: ${commonSymptoms}, Detailed Symptoms: ${detailedSymptoms}`);

      if (pincode) {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${pincode}&key=${OPEN_CAGE_API_KEY}&countrycode=in`;

        // Use https to make the request
        await new Promise((resolve, reject) => {
          https.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => (data += chunk)); // Accumulate the response data
            response.on('end', () => {
              const parsedData = JSON.parse(data);
              if (parsedData.results.length > 0) {
                const { lat, lng } = parsedData.results[0].geometry;
                locationData.push({
                  pincode: pincode,
                  latitude: lat,
                  longitude: lng,
                  commonSymptoms: commonSymptoms,
                  detailedSymptoms: detailedSymptoms
                });
              }
              resolve();
            });
          }).on('error', (error) => reject(error));
        });
      }
    }
    res.json(locationData); // Return the location data with lat/lng and symptoms
  } catch (error) {
    console.error('Error fetching location data:', error);
    res.status(500).send({ message: 'Error fetching location data' });
  }
});

app.get('/api/symptoms/:pincode', async (req, res) => {
	try {
		const { pincode } = req.params;
		const symptomData = await Symptom.findOne({ pincode });

		if (!symptomData) {
			return res
				.status(404)
				.json({ message: 'No symptom data found for this pincode' });
		}

		res.json({
			commonSymptoms: symptomData.commonSymptoms,
			detailedSymptoms: symptomData.detailedSymptoms,
			severity: symptomData.severity,
		});
	} catch (error) {
		console.error('Error fetching symptom data:', error);
		res.status(500).send({ message: 'Error fetching symptom data' });
	}
});


// Start the server
app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
