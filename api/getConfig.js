module.exports = (req, res) => {
    res.json({
        clientId: process.env.GC_OAUTH_CLIENT_ID,
        awsApiEndpoint: process.env.AWS_API_ENDPOINT,
        awsApiKey: process.env.AWS_API_KEY
    });
};
