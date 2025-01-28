let platformClient = require('platformClient');

module.exports = async (req, res) => {
    const contactId = req.query.contactId;
    if (!contactId) {
        return res.status(400).json({ error: 'contactId is required' });
    }

    const journeyApi = new platformClient.JourneyApi();
    const opts = {
        'pageSize': '200' // Maximum page size
    };

    try {
        const sessionsData = await journeyApi.getExternalcontactsContactJourneySessions(contactId, opts);
        res.json(sessionsData);
    } catch (error) {
        console.error("Error fetching external contact sessions:", error);
        res.status(500).json({ error: 'Failed to fetch external contact sessions', details: error.toString() });
    }
};
