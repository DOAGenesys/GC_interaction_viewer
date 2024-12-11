let config = null;

function getConfig() {
    return fetch('/api/getConfig')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to get config');
            }
            return response.json();
        });
}

function getConversationId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('conversationId');
}

async function updateUI(customerName, destinationDetails) {
    document.getElementById('customerName').value = customerName || '';
    document.getElementById('destinationName').value = destinationDetails?.name || '';
    document.getElementById('destinationNumber').value = destinationDetails?.contactNumber || '';
    document.getElementById('dialButton').disabled = !destinationDetails?.contactNumber;
}

async function dialNumber() {
    const destinationNumber = document.getElementById('destinationNumber').value;
    const destinationName = document.getElementById('destinationName').value;
    if (!destinationNumber) {
        alert('No destination number available');
        return;
    }

    try {
        await window.conversationHandler.initiateCall(destinationNumber);
        alert('Call initiated successfully');
    } catch (error) {
        alert('Failed to initiate call: ' + error.message);
    }
}

async function initialize() {
    try {
        // Get configuration
        config = await getConfig();
        
        // Initialize Genesys Cloud
        await startGCSDKs(config.clientId);
        
        // Get conversation ID from URL
        const conversationId = getConversationId();
        if (!conversationId) {
            throw new Error('No conversation ID provided');
        }

        // Get conversation details
        const conversationDetails = await window.conversationHandler.getConversationDetails(conversationId);
        
        // Get destination details
        const destinationDetails = await window.conversationHandler.getDestinationNumber(config);

        // Update UI
        updateUI(conversationDetails.customerName, destinationDetails);
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize application: ' + error.message);
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
