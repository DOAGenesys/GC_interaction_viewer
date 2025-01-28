let config = null;
let platformClient = null;

async function getConfig() {
    console.log("Interaction Viewer - Fetching configuration from /api/getConfig");
    const response = await fetch('/api/getConfig');
    if (!response.ok) {
        console.error("Interaction Viewer - Failed to fetch config, status:", response.status);
        throw new Error('Failed to get config');
    }
    console.log("Interaction Viewer - Successfully retrieved configuration");
    return response.json();
}

function getConversationId() {
    console.log("Interaction Viewer - Extracting conversation ID from URL parameters");
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversationId');
    console.log("Interaction Viewer - Conversation ID found:", conversationId || 'none');
    return conversationId;
}

async function fetchConversationDetails(conversationId) {
    console.log(`Interaction Viewer - Fetching conversation details for ${conversationId}`);
    const response = await fetch(`/api/getConversationDetails?conversationId=${conversationId}`);
    if (!response.ok) {
        console.error("Interaction Viewer - Failed to fetch conversation details, status:", response.status);
        throw new Error('Failed to fetch conversation details');
    }
    return response.json();
}

async function fetchExternalContactSessions(contactId) {
    console.log(`Interaction Viewer - Fetching external contact sessions for ${contactId}`);
    const response = await fetch(`/api/getExternalContactSessions?contactId=${contactId}`);
    if (!response.ok) {
        console.error("Interaction Viewer - Failed to fetch external contact sessions, status:", response.status);
        throw new Error('Failed to fetch external contact sessions');
    }
    return response.json();
}

async function fetchTranscriptUrl(conversationId, communicationId) {
    console.log(`Interaction Viewer - Fetching transcript URL for conversation ${conversationId}, communication ${communicationId}`);
    const response = await fetch(`/api/getTranscriptUrl?conversationId=${conversationId}&communicationId=${communicationId}`);
    if (!response.ok) {
        console.error("Interaction Viewer - Failed to fetch transcript URL, status:", response.status);
        throw new Error('Failed to fetch transcript URL');
    }
    return response.json();
}

async function fetchTranscriptData(transcriptUrl) {
    console.log(`Interaction Viewer - Fetching transcript data from URL`);
    const response = await fetch(transcriptUrl.url);
    if (!response.ok) {
        console.error("Interaction Viewer - Failed to fetch transcript data, status:", response.status);
        throw new Error('Failed to fetch transcript data');
    }
    return response.json();
}

async function fetchConversationSummary(conversationId) {
    console.log(`Interaction Viewer - Fetching conversation summary for ${conversationId}`);
    const response = await fetch(`/api/getConversationSummary?conversationId=${conversationId}`);
    if (!response.ok) {
        console.error("Interaction Viewer - Failed to fetch conversation summary, status:", response.status);
        throw new Error('Failed to fetch conversation summary');
    }
    return response.json();
}


function processTranscript(transcriptJson) {
    if (!transcriptJson || !transcriptJson.transcripts || transcriptJson.transcripts.length === 0 || !transcriptJson.transcripts[0].phrases) {
        return "<p>No transcript available.</p>";
    }

    const phrases = transcriptJson.transcripts[0].phrases;
    let transcriptHTML = '';
    let currentParticipant = null;

    phrases.forEach(phrase => {
        const participantPurpose = phrase.participantPurpose || 'unknown';
        const text = phrase.text;

        if (participantPurpose !== currentParticipant) {
            transcriptHTML += `<p><strong>${participantPurpose.toUpperCase()}:</strong> ${text}</p>`;
            currentParticipant = participantPurpose;
        } else {
            transcriptHTML += `<p>${text}</p>`;
        }
    });
    return transcriptHTML;
}


function displayConversationHistory(sessionsByType) {
    const historyByTypeDiv = document.getElementById('historyByType');
    historyByTypeDiv.innerHTML = '';

    for (const mediaType in sessionsByType) {
        const mediaTypeSection = document.createElement('div');
        mediaTypeSection.classList.add('media-type-section');

        const mediaTypeHeader = document.createElement('h4');
        mediaTypeHeader.textContent = `${mediaType} Conversations`;
        mediaTypeSection.appendChild(mediaTypeHeader);

        const sessions = sessionsByType[mediaType];
        if (sessions.length === 0) {
            const noSessionsMessage = document.createElement('p');
            noSessionsMessage.textContent = `No ${mediaType} conversations found.`;
            mediaTypeSection.appendChild(noSessionsMessage);
        } else {
            const sessionsList = document.createElement('ul');
            sessions.forEach(session => {
                const sessionItem = document.createElement('li');
                sessionItem.classList.add('session-item');

                const sessionHeader = document.createElement('div');
                sessionHeader.classList.add('session-header');
                sessionHeader.innerHTML = `
                    <a href="https://apps.${window.environment}/directory/#/analytics/interactions/${session.id}/admin" target="_blank" class="conversation-id-link">${session.id}</a>
                    <span>${session.originatingDirection}</span>
                    <span>${session.createdDate}</span>
                    ${session.conversationSubject ? `<span>Subject: ${session.conversationSubject}</span>` : ''}
                `;
                sessionItem.appendChild(sessionHeader);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('session-details');

                // Transcription Section
                const transcriptionSection = document.createElement('div');
                transcriptionSection.classList.add('detail-section', 'collapsed');
                const transcriptionHeader = document.createElement('h5');
                transcriptionHeader.textContent = 'Transcription';
                transcriptionHeader.classList.add('section-header');
                transcriptionHeader.addEventListener('click', async () => {
                    transcriptionSection.classList.toggle('collapsed');
                    if (!transcriptionSection.dataset.transcriptLoaded) {
                        transcriptionSection.dataset.transcriptLoaded = 'true';
                        const transcriptContent = document.createElement('div');
                        transcriptContent.classList.add('section-content');
                        transcriptContent.innerHTML = '<p>Loading transcription...</p>';
                        transcriptionSection.appendChild(transcriptContent);

                        try {
                            const agentSession = session.agentSession;
                            if (agentSession && agentSession.sessionId) {
                                const transcriptUrlData = await fetchTranscriptUrl(session.id, agentSession.sessionId);
                                const transcriptData = await fetchTranscriptData(transcriptUrlData);
                                const transcriptHTML = processTranscript(transcriptData);
                                transcriptContent.innerHTML = transcriptHTML;
                            } else {
                                transcriptContent.innerHTML = '<p>Agent session ID not found, cannot load transcript.</p>';
                            }

                        } catch (error) {
                            console.error("Error loading transcription:", error);
                            transcriptContent.innerHTML = `<p>Error loading transcription: ${error.message}</p>`;
                        }
                    }
                });
                transcriptionSection.appendChild(transcriptionHeader);
                detailsDiv.appendChild(transcriptionSection);


                // Summary Section
                const summarySection = document.createElement('div');
                summarySection.classList.add('detail-section', 'collapsed');
                const summaryHeader = document.createElement('h5');
                summaryHeader.textContent = 'Summary';
                summaryHeader.classList.add('section-header');

                summaryHeader.addEventListener('click', async () => {
                    summarySection.classList.toggle('collapsed');
                    if (!summarySection.dataset.summaryLoaded) {
                        summarySection.dataset.summaryLoaded = 'true';
                        const summaryContent = document.createElement('div');
                        summaryContent.classList.add('section-content');
                        summaryContent.innerHTML = '<p>Loading summary...</p>';
                        summarySection.appendChild(summaryContent);

                        try {
                            const summaryData = await fetchConversationSummary(session.id);
                            const summaryText = summaryData.summary?.text || 'N/A';
                            const reasonText = summaryData.summary?.reason?.text || 'N/A';
                            const followupText = summaryData.summary?.followup?.text || 'N/A';
                            const resolutionText = summaryData.summary?.resolution?.text || 'N/A';

                            summaryContent.innerHTML = `
                                <p><strong>Summary:</strong> ${summaryText}</p>
                                <p><strong>Reason:</strong> ${reasonText}</p>
                                <p><strong>Follow up:</strong> ${followupText}</p>
                                <p><strong>Resolution:</strong> ${resolutionText}</p>
                            `;
                        } catch (error) {
                            console.error("Error loading summary:", error);
                            summaryContent.innerHTML = `<p>Error loading summary: ${error.message}</p>`;
                        }
                    }
                });
                summarySection.appendChild(summaryHeader);
                detailsDiv.appendChild(summarySection);


                sessionItem.appendChild(detailsDiv);
                sessionsList.appendChild(sessionItem);
            });
            mediaTypeSection.appendChild(sessionsList);
        }
        historyByTypeDiv.appendChild(mediaTypeSection);
    }
}


async function initialize() {
    console.log("Interaction Viewer - Starting application initialization");
    try {
        config = await getConfig();
        platformClient = await startGCSDKs(config.clientId);

        const conversationId = getConversationId();
        if (!conversationId) {
            throw new Error('No conversation ID provided in URL parameters.');
        }

        const conversationDetails = await fetchConversationDetails(conversationId);

        let externalContactId = null;
        const customerParticipant = conversationDetails.participants.find(p => p.purpose === 'customer' || p.purpose === 'external');
        if (customerParticipant && customerParticipant.externalContactId) {
            externalContactId = customerParticipant.externalContactId;
        } else {
            console.warn("Customer or external contact ID not found, using default.");
            // Fallback if externalContactId is not reliably found. Consider other identifiers if available.
            externalContactId = customerParticipant?.participantId; // Using participantId as fallback, might not be ideal.
        }


        let agentCommunicationId = null;
        const agentParticipant = conversationDetails.participants.find(p => p.purpose === 'agent' || p.purpose === 'internal');
        let agentSessionInfo = null;
        if (agentParticipant && agentParticipant.sessions && agentParticipant.sessions.length > 0) {
            agentSessionInfo = agentParticipant.sessions[0]; // Assuming first session is relevant communication
            agentCommunicationId = agentSessionInfo.sessionId;
        }


        const sessionsData = await fetchExternalContactSessions(externalContactId);
        const relevantSessions = sessionsData.entities.filter(session =>
            session.lastEvent?.eventName === "com.genesys.analytics.detailevents.FlowStartEvent" ||
            session.lastEvent?.eventName === "com.genesys.analytics.detailevents.AcdStartEvent"
        );

        const sessionsByType = {};
        relevantSessions.forEach(session => {
            const mediaType = session.conversationChannels[0]?.type || 'Unknown Media Type';
            if (!sessionsByType[mediaType]) {
                sessionsByType[mediaType] = [];
            }
            const sessionDisplayInfo = {
                id: session.id,
                originatingDirection: session.originatingDirection,
                conversationSubject: session.conversationSubject,
                createdDate: session.createdDate,
                agentSession: agentSessionInfo, // Storing agent session info for transcript retrieval
                mediaType: mediaType
            };
            sessionsByType[mediaType].push(sessionDisplayInfo);
        });

        displayConversationHistory(sessionsByType);


    } catch (error) {
        console.error("Interaction Viewer - Initialization failed:", error);
        alert('Failed to initialize application: ' + error.message);
    }
}


document.addEventListener('DOMContentLoaded', initialize);
