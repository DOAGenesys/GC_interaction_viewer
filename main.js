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
    try {
        const data = await externalContactsApi.getExternalcontactsContacts({
            pageSize: 10, 
            pageNumber: 1
        });

        const favoritedContacts = data.entities.filter(contact => contact.customFields && contact.customFields.isFavorite === true);
        
        // Display the favorited contacts in the speed dial section
        favoritedContacts.forEach(contact => addToSpeedDials(contact, true));
        updateSpeedDialUI();
    } catch (err) {
        console.error('Error fetching favorited contacts:', err);
    }
}

// Search function triggered by the search button
async function searchExternalContacts() {
    const searchText = document.getElementById('searchTextbox').value;
    try {
        // Update the API call with search text and default paging options
        const data = await externalContactsApi.getExternalcontactsContacts({
            pageSize: 10,
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
            favButton.textContent = 'Favorite';
            favButton.onclick = () => addToSpeedDials(contact);
            li.appendChild(favButton);

            resultsSection.appendChild(li);
        });
    }
}

// Function to add a contact to the speed dials list
function addToSpeedDials(contact, skipCheck = false) {
    if (speedDials.length >= 10 && !skipCheck) {
        alert('Speed dial list can only contain up to 10 contacts.');
        return;
    }

    if (speedDials.find(dial => dial.id === contact.id) && !skipCheck) {
        alert('This contact is already in your speed dial list.');
        return;
    }

    speedDials.push(contact);
}

// Function to update the speed dial section in the UI
function updateSpeedDialUI() {
    const speedDialList = document.getElementById('speedDialList');
    speedDialList.innerHTML = '';

    speedDials.forEach((contact, index) => {
        const li = document.createElement('li');
        li.textContent = `${contact.firstName} ${contact.lastName} - ${contact.workPhone ? contact.workPhone.e164 : 'N/A'}`;

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.onclick = () => removeFromSpeedDials(index);
        removeButton.style.marginLeft = '10px';
        removeButton.className = 'removeButton';

        li.appendChild(removeButton);
        speedDialList.appendChild(li);
    });
}

// Function to remove a contact from the speed dials list
function removeFromSpeedDials(index) {
    speedDials.splice(index, 1);
    updateSpeedDialUI();
}
