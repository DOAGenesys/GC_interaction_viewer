let fetch;

module.exports = async (req, res) => {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    }

    const { uri } = req.query;
    const bearerToken = req.headers.authorization;

    console.log(`Received Transcript URI: ${uri}`);
    console.log(`Received Bearer Token for Transcript: ${bearerToken}`);

    if (!uri) {
        console.log("Transcript URI missing from query parameters");
        return res.status(400).json({ error: 'Transcript URI is required' });
    }

    if (!bearerToken) {
        console.log("Authorization token missing from headers");
        return res.status(401).json({ error: 'Authorization token is missing' });
    }

    try {
        console.log("Attempting to fetch transcript from URI...");
        const response = await fetch(uri, {
            headers: {
                'Authorization': bearerToken
            }
        });

        console.log(`Transcript Fetch Response Status: ${response.status}`);
        console.log(`Transcript Fetch Response Status Text: ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`Failed to download the transcript: ${response.statusText}`);
        }

        const transcriptData = await response.json(); // Expecting JSON response for transcript
        console.log("Successfully fetched transcript data.");

        res.setHeader('Content-Type', 'application/json'); // Set Content-Type to application/json
        res.send(JSON.stringify(transcriptData)); // Send JSON data as string

    } catch (error) {
        console.error(`Error occurred while fetching transcript:`, error);
        res.status(500).json({ error: 'Failed to fetch transcript', details: error.toString() });
    }
};
