window.conversationHandler = (function() {
    console.log("TAS Vet ROTA Dialer - Initializing conversation handler module");
    
    const platformClient = require('platformClient');
    let conversationApi = new platformClient.ConversationsApi();
    let storedData = {
        externalContactId: null,
        queueId: null,
        customerName: null
    };

    async function getConversationDetails(conversationId) {
        console.log("TAS Vet ROTA Dialer - Fetching conversation details for ID:", conversationId);
        try {
            console.log("TAS Vet ROTA Dialer - Making API call to get conversation callback details");
            const data = await conversationApi.getConversationsCallback(conversationId);
            console.log("TAS Vet ROTA Dialer - Retrieved conversation data:", JSON.stringify(data, null, 2));
            
            const customerParticipant = data.participants.find(p => p.purpose === 'customer');
            if (!customerParticipant) {
                console.error("TAS Vet ROTA Dialer - No customer participant found in conversation data");
                throw new Error('No customer participant found');
            }

            console.log("TAS Vet ROTA Dialer - Found customer participant:", JSON.stringify(customerParticipant, null, 2));

            storedData.externalContactId = customerParticipant.externalContact?.id;
            storedData.queueId = customerParticipant.queue?.id;
            storedData.customerName = customerParticipant.name;

            console.log("TAS Vet ROTA Dialer - Stored conversation data:", JSON.stringify(storedData, null, 2));

            return {
                customerName: customerParticipant.name,
                externalContactId: customerParticipant.externalContact?.id,
                queueId: customerParticipant.queue?.id
            };
        } catch (error) {
            console.error("TAS Vet ROTA Dialer - Error fetching conversation details:", error);
            throw error;
        }
    }

    async function getDestinationNumber(config) {
        console.log("TAS Vet ROTA Dialer - Starting destination number fetch");
        try {
            const currentDateTime = new Date().toISOString().split('.')[0] + 'Z';
            console.log("TAS Vet ROTA Dialer - Using datetime:", currentDateTime);
    
            const url = `/api/getActiveVet?datetime=${currentDateTime}`;
            console.log("TAS Vet ROTA Dialer - Making API call to:", url);
    
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache'
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.error("TAS Vet ROTA Dialer - API response error:", {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
                throw new Error(`API call failed: ${response.status} ${response.statusText}`);
            }
    
            const data = await response.json();
            console.log("TAS Vet ROTA Dialer - API response success:", data);
    
            if (!data.tableMatch) {
                console.warn("TAS Vet ROTA Dialer - No active vet found for the current time");
                return {
                    name: '',
                    contactNumber: ''
                };
            }
    
            return {
                name: data.destinationDetails.name,
                contactNumber: data.destinationDetails.contactNumber
            };
        } catch (error) {
            console.error("TAS Vet ROTA Dialer - Error fetching destination number:", {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async function initiateCall(phoneNumber) {
        console.log("TAS Vet ROTA Dialer - Initiating call with stored data:", {
            queueId: storedData.queueId,
            externalContactId: storedData.externalContactId
        });
    
        try {
            const body = {
                phoneNumber: phoneNumber,
                callFromQueueId: storedData.queueId,
                externalContactId: storedData.externalContactId,
                label: "generated via interaction widget"
            };
    
            console.log("TAS Vet ROTA Dialer - Making API call to initiate call:", JSON.stringify(body, null, 2));
            const result = await conversationApi.postConversationsCalls(body);
            console.log("TAS Vet ROTA Dialer - Call initiated successfully:", JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error("TAS Vet ROTA Dialer - Error initiating call:", error);
            throw error;
        }
    }

    return {
        getConversationDetails,
        getDestinationNumber,
        initiateCall
    };
})();
