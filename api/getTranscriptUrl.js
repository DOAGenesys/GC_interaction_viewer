let platformClient = require('platformClient');

module.exports = async (req, res) => {
    const conversationId = req.query.conversationId;
    const communicationId = req.query.communicationId;

    if (!conversationId || !communicationId) {
        return res.status(400).json({ error: 'conversationId and communicationId are required' });
    }

    const speechTextAnalyticsApi = new platformClient.SpeechTextAnalyticsApi();

    try {
        const transcriptUrlData = await speechTextAnalyticsApi.getSpeechandtextanalyticsConversationCommunicationTranscripturl(conversationId, communicationId);
        res.json(transcriptUrlData);
    } catch (error) {
        console.error("Error fetching transcript URL:", error);
        res.status(500).json({ error: 'Failed to fetch transcript URL', details: error.toString() });
    }
};
