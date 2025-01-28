let platformClient = require('platformClient');

module.exports = async (req, res) => {
    const conversationId = req.query.conversationId;
    if (!conversationId) {
        return res.status(400).json({ error: 'conversationId is required' });
    }

    const conversationsApi = new platformClient.ConversationsApi();

    try {
        const summaryData = await conversationsApi.getConversationSummaries(conversationId);
        res.json(summaryData);
    } catch (error) {
        console.error("Error fetching conversation summary:", error);
        res.status(500).json({ error: 'Failed to fetch conversation summary', details: error.toString() });
    }
};
