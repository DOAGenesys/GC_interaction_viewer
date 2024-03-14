let agentParticipantId = '';
let customerParticipantId = '';

const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;

function getParticipantIds() {
    console.log("getParticipantIds started");
    let apiInstance = new platformClient.ConversationsApi();

    apiInstance.getConversation(window.conversationId)
        .then((data) => {
            console.log("Conversation data:", data);
            let participants = data.participants;
            console.log("Participants:", participants);
            for (let i = 0; i < participants.length; i++) {
                if (participants[i].purpose === 'agent') {
                    agentParticipantId = participants[i].id;
                    console.log("Setting agentParticipantId:", agentParticipantId);
                } else if (participants[i].purpose === 'customer') {
                    customerParticipantId = participants[i].id;
                    console.log("Setting customerParticipantId:", customerParticipantId);
                }
            }
        })
        .catch((err) => {
            console.log("There was a failure calling getConversation:", err);
        });
}

const conversationsApi = new platformClient.ConversationsApi();
const routingApi = new platformClient.RoutingApi();

function populateQueues(selectId) {
    // Retrieve queue list
    routingApi.getRoutingQueues({pageSize: 1000})
        .then((data) => {
            // Populate the dropdown with queue names
            var select = document.getElementById(selectId);
            for(var i = 0; i < data.entities.length; i++) {
                var opt = data.entities[i];
                var el = document.createElement("option");
                el.textContent = opt.name;
                el.value = opt.id;
                select.appendChild(el);
            }
        })
        .catch((err) => {
            console.log("Error retrieving queue list");
            console.error(err);
        });
}

function consultTransfer() {
    var speakTo = document.querySelector("#speakToSelect").value;
    var queueId = document.querySelector("#queueSelectConsult").value;
    var body = {
        "speakTo": speakTo,
        "destination": {
            "queueId": queueId
        }
    };

    conversationsApi.postConversationsCallParticipantConsult(window.conversationId, customerParticipantId, body)
        .then((data) => {
            console.log(`Consult transfer success! data: ${JSON.stringify(data, null, 2)}`);

            // Clear all the elements from the UI
            document.querySelector("#consultTransferElements").innerHTML = '';

            // Create a new button for confirming the consult transfer
            let confirmButton = document.createElement('button');
            confirmButton.id = 'confirmConsultTransferButton';
            confirmButton.textContent = 'Confirm consult transfer';
            document.querySelector("#consultTransferElements").appendChild(confirmButton);

            // Add an event listener to the confirm button
            document.querySelector("#confirmConsultTransferButton").addEventListener("click", confirmConsultTransfer);
        })
        .catch((err) => {
            console.log("Error initiating consult transfer");
            console.error(err);
        });
}

function confirmConsultTransfer() {
    // Make the second API call
    let patchBody = {
        "state": "DISCONNECTED"
    };
    conversationsApi.patchConversationsCallParticipant(window.conversationId, agentParticipantId, patchBody)
        .then((data) => {
            console.log(`Agent disconnected successfully! data: ${JSON.stringify(data, null, 2)}`);
        })
        .catch((err) => {
            console.log("Error disconnecting the agent");
            console.error(err);
        });
}

function blindTransfer() {
    var queueId = document.querySelector("#queueSelectBlind").value;
    var body = {
        "queueId": queueId
    };

    console.log("window.conversationId:", window.conversationId);
    console.log("agentParticipantId:", agentParticipantId);  // corrected variable

    conversationsApi.postConversationsCallParticipantReplace(window.conversationId, agentParticipantId, body)  // corrected variable
        .then(() => {
            console.log("Blind transfer returned successfully.");
        })
        .catch((err) => {
            console.log("Error initiating blind transfer");
            console.error(err);
        });
}

function startConsultTransfer() {
    // Code to display the Consult transfer elements
    document.querySelector("#transferTypeSelection").style.display = "none";
    document.querySelector("#consultTransferElements").style.display = "block";

    getParticipantIds();

    // Populate the queues dropdown
    populateQueues("queueSelectConsult");

    // Clear the speakTo dropdown
    let select = document.querySelector("#speakToSelect");
    select.innerHTML = '';

    // Populate the speakTo dropdown
    let speakToOptions = ["DESTINATION", "OBJECT", "BOTH", "CONFERENCE"];
    for(let option of speakToOptions) {
        let el = document.createElement("option");
        el.textContent = option;
        el.value = option;
        select.appendChild(el);
    }

    // Remove any existing "Next" button
    let existingNextButton = document.querySelector("#nextButton");
    if (existingNextButton) {
        existingNextButton.remove();
    }

    // Create a new "Next" button
    let nextButton = document.createElement('button');
    nextButton.id = 'nextButton';
    nextButton.textContent = 'Next';
    document.querySelector("#consultTransferElements").appendChild(nextButton);

    // Add an event listener to the "Next" button
    document.querySelector("#nextButton").addEventListener("click", consultTransfer);
}

function startBlindTransfer() {
    // Code to display the Blind transfer elements
    document.querySelector("#transferTypeSelection").style.display = "none";
    document.querySelector("#blindTransferElements").style.display = "block";

    getParticipantIds();
    
    // Populate the queues dropdown
    populateQueues("queueSelectBlind");
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOMContentLoaded event fired'); 
    document.querySelector("#blindTransferButton").addEventListener("click", startBlindTransfer);
    document.querySelector("#consultTransferButton").addEventListener("click", startConsultTransfer);
    document.querySelector("#confirmBlindTransferButton").addEventListener("click", blindTransfer);
});
