let config = null;

function getConfig() {
    console.log("TAS Vet ROTA Dialer - Fetching configuration from /api/getConfig");
    return fetch('/api/getConfig')
        .then(response => {
            if (!response.ok) {
                console.error("TAS Vet ROTA Dialer - Failed to fetch config, status:", response.status);
                throw new Error('Failed to get config');
            }
            console.log("TAS Vet ROTA Dialer - Successfully retrieved configuration");
            return response.json();
        });
}

function getConversationId() {
    console.log("TAS Vet ROTA Dialer - Extracting conversation ID from URL parameters");
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversationId');
    console.log("TAS Vet ROTA Dialer - Conversation ID found:", conversationId || 'none');
    return conversationId;
}

async function updateUI(customerName, destinationDetails) {
    console.log("TAS Vet ROTA Dialer - Updating UI with:", {
        customerName,
        destinationName: destinationDetails?.name,
        destinationNumber: destinationDetails?.contactNumber
    });

    document.getElementById('customerName').value = customerName || '';
    document.getElementById('destinationName').value = destinationDetails?.name || '';
    document.getElementById('destinationNumber').value = destinationDetails?.contactNumber || '';
    document.getElementById('dialButton').disabled = !destinationDetails?.contactNumber;
    
    console.log("TAS Vet ROTA Dialer - UI update complete. Dial button state:", !destinationDetails?.contactNumber ? 'disabled' : 'enabled');
}

async function dialNumber() {
    const destinationNumber = document.getElementById('destinationNumber').value;
    const destinationName = document.getElementById('destinationName').value;
    
    console.log("TAS Vet ROTA Dialer - Attempting to dial number:", {
        destinationName,
        destinationNumber: destinationNumber ? '****' + destinationNumber.slice(-4) : 'none'
    });

    if (!destinationNumber) {
        console.warn("TAS Vet ROTA Dialer - Dial attempted with no destination number available");
        alert('No destination number available');
        return;
    }

    try {
        console.log("TAS Vet ROTA Dialer - Initiating call via conversation handler");
        await window.conversationHandler.initiateCall(destinationNumber);
        console.log("TAS Vet ROTA Dialer - Call initiated successfully");
        alert('Call initiated successfully');
    } catch (error) {
        console.error("TAS Vet ROTA Dialer - Call initiation failed:", error);
        alert('Failed to initiate call: ' + error.message);
    }
}

async function initialize() {
    console.log("TAS Vet ROTA Dialer - Starting application initialization");
    try {
        console.log("TAS Vet ROTA Dialer - Fetching configuration");
        config = await getConfig();
        
        console.log("TAS Vet ROTA Dialer - Initializing Genesys Cloud SDKs");
        await startGCSDKs(config.clientId);
        
        const conversationId = getConversationId();
        if (!conversationId) {
            console.error("TAS Vet ROTA Dialer - Initialization failed: No conversation ID provided");
            throw new Error('No conversation ID provided');
        }

        console.log("TAS Vet ROTA Dialer - Fetching conversation details");
        const conversationDetails = await window.conversationHandler.getConversationDetails(conversationId);
        
        console.log("TAS Vet ROTA Dialer - Fetching destination details");
        const destinationDetails = await window.conversationHandler.getDestinationNumber(config);

        console.log("TAS Vet ROTA Dialer - Updating UI with fetched details");
        await updateUI(conversationDetails.customerName, destinationDetails);
        
        console.log("TAS Vet ROTA Dialer - Application initialization complete");
    } catch (error) {
        console.error("TAS Vet ROTA Dialer - Initialization failed:", error);
        alert('Failed to initialize application: ' + error.message);
    }
}

console.log("TAS Vet ROTA Dialer - Setting up DOM content loaded listener");
document.addEventListener('DOMContentLoaded', initialize);
