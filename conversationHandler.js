window.conversationHandler = (function() {
    const platformClient = require('platformClient');
    let conversationApi = new platformClient.ConversationsApi();
    let storedData = {
        externalContactId: null,
        queueId: null,
        customerName: null
    };

    async function getConversationDetails(conversationId) {
        try {
            const data = await conversationApi.getConversationsCallback(conversationId);
            
            // Find customer participant
            const customerParticipant = data.participants.find(p => p.purpose === 'customer');
            if (!customerParticipant) {
                throw new Error('No customer participant found');
            }

            // Store necessary data
            storedData.externalContactId = customerParticipant.externalContact?.id;
            storedData.queueId = customerParticipant.queue?.id;
            storedData.customerName = customerParticipant.name;

            return {
                customerName: customerParticipant.name,
                externalContactId: customerParticipant.externalContact?.id,
                queueId: customerParticipant.queue?.id
            };
        } catch (error) {
            console.error('Error fetching conversation details:', error);
            throw error;
        }
    }

    async function getDestinationNumber(config) {
        try {
            const currentDateTime = new Date().toISOString().split('.')[0] + 'Z';
            const response = await fetch(`${config.awsApiEndpoint}?datetime=${currentDateTime}`, {
                headers: {
                    'x-api-key': config.awsApiKey
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch destination number');
            }

            const data = await response.json();
            return data.destinationDetails.contactNumber;
        } catch (error) {
            console.error('Error fetching destination number:', error);
            throw error;
        }
    }

    async function initiateCall(phoneNumber) {
        try {
            const body = {
                phoneNumber: phoneNumber,
                callerIdName: storedData.customerName,
                callFromQueueId: storedData.queueId,
                externalContactId: storedData.externalContactId,
                label: "generated via interaction widget"
            };

            const result = await conversationApi.postConversationsCalls(body);
            console.log('Call initiated successfully:', result);
            return result;
        } catch (error) {
            console.error('Error initiating call:', error);
            throw error;
        }
    }

    return {
        getConversationDetails,
        getDestinationNumber,
        initiateCall
    };
})();
