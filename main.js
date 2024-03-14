// Define necessary global variables
let speedDials = [];

// PureCloud Platform Client and API instances
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const externalContactsApi = new platformClient.ExternalContactsApi();

function getConfig() {
    return fetch('/api/getConfig')
        .then(response => {
            if (!response.ok) {
                throw new Error('Environment vars could not be retrieved');
            }
            return response.json();
        });
}

async function start() {
    try {
        const config = await getConfig();
        startGCSDKs(config.clientId);
        fetchAndDisplayFavoritedContacts();
    } catch (error) {
        console.error('Error occurred while starting:', error);
    }
}

async function fetchAndDisplayFavoritedContacts() {
    let pageNumber = 1;
    let pageCount = 0;
    do {
        try {
            // Make an API call to fetch a page of contacts
            const data = await externalContactsApi.getExternalcontactsContacts({
                pageSize: 100, 
                pageNumber: pageNumber
            });

            // Update pageCount from the API response
            pageCount = data.pageCount;

            // Filter favorited contacts and add them to speed dials
            const favoritedContacts = data.entities.filter(contact =>
                contact.customFields && contact.customFields['speed_dial_checkbox'] === true
            );
            favoritedContacts.forEach(contact => addToSpeedDials(contact, true));

            // Increment pageNumber to fetch the next page in the next iteration
            pageNumber++;
        } catch (err) {
            console.error('Error fetching favorited contacts:', err);
            break;
        }
    } while (pageNumber <= pageCount); // Continue until all pages have been processed

    // Once all pages have been processed and favorited contacts added, update the UI
    updateSpeedDialUI();
}

// Search function triggered by the search button
async function searchExternalContacts() {
    const searchText = document.getElementById('searchTextbox').value;
    try {
        // Update the API call with search text and default paging options
        const data = await externalContactsApi.getExternalcontactsContacts({
            pageSize: 100,
            pageNumber: 1,
            q: searchText
        });

        // Display the search results and check for speed dial preferences
        displaySearchResults(data.entities);
        // Update the speed dial UI in case new favorites were found
        updateSpeedDialUI();
    } catch (err) {
        console.error('Error searching external contacts:', err);
    }
}

// Function to display search results and add to the HTML
function displaySearchResults(contacts) {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.innerHTML = ''; // Clear previous results

    let noResultsMessage = document.getElementById('noResultsMessage');
    if (!noResultsMessage) {
        noResultsMessage = document.createElement('div');
        noResultsMessage.id = 'noResultsMessage';
        noResultsMessage.style.display = 'none';
        noResultsMessage.textContent = 'No results found.';
        resultsSection.appendChild(noResultsMessage);
    }

    if (contacts.length === 0) {
        noResultsMessage.style.display = 'block';
    } else {
        noResultsMessage.style.display = 'none';
        contacts.forEach(contact => {
            // Automatically add contacts with speed_dial_checkbox set to true to favorites
            if (contact.customFields && contact.customFields.speed_dial_checkbox === true) {
                addToSpeedDials(contact, true); // Passing true to bypass checks
            }

            const li = document.createElement('li');
            li.textContent = `${contact.firstName} ${contact.lastName} - ${contact.workPhone ? contact.workPhone.e164 : 'N/A'}`;

            const favButton = document.createElement('button');
            favButton.textContent = 'Favourite';
            favButton.onclick = () => addToSpeedDials(contact);
            li.appendChild(favButton);

            resultsSection.appendChild(li);
        });
    }
}

// Function to add a contact to the speed dials list and update the backend
async function addToSpeedDials(contact, skipCheck = false) {
    if (speedDials.length >= 10 && !skipCheck) {
        alert('Speed dial list can only contain up to 10 contacts.');
        return;
    }

    if (speedDials.find(dial => dial.id === contact.id) && !skipCheck) {
        alert('This contact is already in your speed dial list.');
        return;
    }

    // Check if we need to update the backend for this contact
    if (contact.customFields && contact.customFields['speed_dial_checkbox'] !== true) {
        // Prepare the payload with speed_dial_checkbox set to true
        const updatedContact = {
            ...contact,
            customFields: {
                ...contact.customFields,
                'speed_dial_checkbox': true
            }
        };

        try {
            // Make an API call to update the contact's speed_dial_checkbox to true
            await externalContactsApi.putExternalcontactsContact(contact.id, updatedContact);
            console.log(`Successfully updated contact: ${contact.id}`);
        } catch (err) {
            console.error(`Error updating contact: ${contact.id}`, err);
            return; // Exit if the update fails
        }
    }

    // Add the contact to the local speedDials array and update the UI
    speedDials.push(contact);
    updateSpeedDialUI();
}

// Function to update the speed dial section in the UI
function updateSpeedDialUI() {
    const speedDialList = document.getElementById('speedDialList');
    speedDialList.innerHTML = '';

    speedDials.forEach((contact, index) => {
        const li = document.createElement('li');
        li.className = 'contact-item'; 
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'contact-name';
        nameSpan.textContent = `${contact.firstName} ${contact.lastName}`;
        
        const phoneSpan = document.createElement('span');
        phoneSpan.className = 'contact-phone';
        phoneSpan.textContent = contact.workPhone ? contact.workPhone.e164 : 'N/A';
        
        li.appendChild(nameSpan);
        li.appendChild(phoneSpan);

        const dialButton = document.createElement('button');
        dialButton.className = 'dialButton';
        dialButton.innerHTML = '&#128222;'; // HTML entity for a phone icon
        dialButton.onclick = () => dialContact(contact.workPhone.e164);
        li.appendChild(dialButton);

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'removeButton';
        removeButton.onclick = () => removeFromSpeedDials(index);
        li.appendChild(removeButton);

        speedDialList.appendChild(li);
    });
}

// Function to dial a contact
function dialContact(phoneNumber) {
    const body = { phoneNumber: phoneNumber, sessionType: 'softphone' };
    
    const apiInstance = new platformClient.ConversationsApi();
    apiInstance.postConversationsCalls(body)
      .then((data) => {
        console.log(`postConversationsCalls success! data: ${JSON.stringify(data, null, 2)}`);
      })
      .catch((err) => {
        console.log('There was a failure calling postConversationsCalls');
        console.error(err);
      });
}

// Function to remove a contact from the speed dials list and update the backend
async function removeFromSpeedDials(index) {
    const contact = speedDials[index];
    if (!contact) return;

    // Prepare the updated payload with speed_dial_checkbox set to false
    const updatedContact = {
        ...contact,
        customFields: {
            ...contact.customFields,
            speed_dial_checkbox: false
        }
    };

    try {
        // Update the contact's speed_dial_checkbox to false
        await externalContactsApi.putExternalcontactsContact(contact.id, updatedContact);
        console.log(`Successfully updated contact: ${contact.id}`);
    } catch (err) {
        console.error(`Error updating contact: ${contact.id}`, err);
    }

    // Remove the contact from the speedDials array and update the UI
    speedDials.splice(index, 1);
    updateSpeedDialUI();
}
