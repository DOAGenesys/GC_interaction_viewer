let config = null;
let platformClient = null;
let conversationsApi = null;
let journeyApi = null;
let speechTextAnalyticsApi = null;

async function getConfig() {
    console.log("GC interaction viewer - Fetching configuration from /api/getConfig");
    const response = await fetch('/api/getConfig');
    if (!response.ok) {
        console.error("GC interaction viewer - Failed to fetch config, status:", response.status);
        throw new Error('Failed to get config');
    }
    console.log("GC interaction viewer - Successfully retrieved configuration");
    return response.json();
}

function getConversationId() {
    console.log("GC interaction viewer - Extracting conversation ID from URL parameters");
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversationId');
    console.log("GC interaction viewer - Conversation ID found:", conversationId || 'none');
    return conversationId;
}

async function fetchConversationDetails(conversationId) {
    console.log(`GC interaction viewer - Fetching conversation details for ${conversationId}`);
    try {
        const conversationDetails = await conversationsApi.getAnalyticsConversationDetails(conversationId);
        return conversationDetails;
    } catch (error) {
        console.error("GC interaction viewer - Failed to fetch conversation details:", error);
        throw new Error('Failed to fetch conversation details: ' + error.message);
    }
}

async function fetchExternalContactSessions(contactId) {
    console.log(`GC interaction viewer - Fetching external contact sessions for ${contactId}`);
    let opts = { 
          "pageSize": "200"
    };
    try {
        const sessionsData = await journeyApi.getExternalcontactsContactJourneySessions(contactId, opts);
        return sessionsData;
    } catch (error) {
        console.error("GC interaction viewer - Failed to fetch external contact sessions:", error);
        throw new Error('Failed to fetch external contact sessions: ' + error.message);
    }
}

async function fetchTranscriptUrl(conversationId, communicationId) {
    console.log(`GC interaction viewer - Fetching transcript URL for conversation ${conversationId}, communication ${communicationId}`);
    try {
        const transcriptUrlData = await speechTextAnalyticsApi.getSpeechandtextanalyticsConversationCommunicationTranscripturl(conversationId, communicationId);
        return transcriptUrlData;
    } catch (error) {
        if (error.status === 404) {
            console.warn("Transcript URL not found (404) for conversation:", conversationId, "communication:", communicationId);
            return null;
        }
        console.error("GC interaction viewer - Failed to fetch transcript URL:", error);
        throw new Error('Failed to fetch transcript URL: ' + error.message);
    }
}

async function fetchTranscriptData(transcriptUrl) {
    console.log(`GC interaction viewer - Fetching transcript data from URL via /api/downloadTranscript`);
    try {
        const response = await fetch(`/api/downloadTranscript?uri=${encodeURIComponent(transcriptUrl.url)}`, {
            headers: {
                'Authorization': `Bearer ${platformClient.ApiClient.instance.authData.accessToken}`
            }
        });
        if (!response.ok) {
            console.error("GC interaction viewer - Failed to fetch transcript data, status:", response.status);
            throw new Error(`Failed to fetch transcript data: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("GC interaction viewer - Error fetching transcript data:", error);
        throw new Error('Error fetching transcript data: ' + error.message);
    }
}


async function fetchConversationSummary(conversationId) {
    console.log(`GC interaction viewer - Fetching conversation summary for ${conversationId}`);
    try {
        const summaryData = await conversationsApi.getConversationSummaries(conversationId);
        return summaryData;
    } catch (error) {
        if (error.status === 404) {
            console.warn("Conversation summary not found (404) for conversation:", conversationId);
            return null;
        }
        console.error("GC interaction viewer - Failed to fetch conversation summary:", error);
        throw new Error('Failed to fetch conversation summary: ' + error.message);
    }
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


async function displayConversationHistory(sessionsByType) {
    console.log('displayConversationHistory called', sessionsByType);
    const historyByTypeDiv = document.getElementById('historyByType');
    historyByTypeDiv.innerHTML = '';

    for (const mediaType in sessionsByType) {
        console.log('Processing mediaType:', mediaType, sessionsByType[mediaType]);
        const mediaTypeSection = document.createElement('div');
        mediaTypeSection.classList.add('media-type-section');

        const mediaTypeHeader = document.createElement('h4');
        mediaTypeHeader.textContent = `${mediaType} Conversations`;
        mediaTypeSection.appendChild(mediaTypeHeader);

        const sessions = sessionsByType[mediaType];
        console.log('Sessions for mediaType', mediaType, ':', sessions);
        if (!sessions || sessions.length === 0) {
            const noSessionsMessage = document.createElement('p');
            noSessionsMessage.textContent = `No ${mediaType} conversations found.`;
            mediaTypeSection.appendChild(noSessionsMessage);
        } else {
            const sessionsList = document.createElement('ul');
            sessions.forEach(session => {
                console.log('Processing session:', session);
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
                            const conversationDetailsForTranscript = await fetchConversationDetails(session.id);
                            let customerCommunicationIdForTranscript = null;
                            const customerParticipantForTranscript = conversationDetailsForTranscript.participants.find(p => p.purpose === 'customer' || p.purpose === 'external');
                            if (customerParticipantForTranscript && customerParticipantForTranscript.sessions && customerParticipantForTranscript.sessions.length > 0) {
                                customerCommunicationIdForTranscript = customerParticipantForTranscript.sessions[0].sessionId;
                            }

                            if (customerCommunicationIdForTranscript) {
                                const transcriptUrlData = await fetchTranscriptUrl(session.id, customerCommunicationIdForTranscript);
                                if (transcriptUrlData) {
                                    const transcriptData = await fetchTranscriptData(transcriptUrlData);
                                    const transcriptHTML = processTranscript(transcriptData);
                                    transcriptContent.innerHTML = transcriptHTML;
                                } else {
                                    transcriptContent.innerHTML = '<p>No transcriptions available.</p>';
                                }
                            } else {
                                transcriptContent.innerHTML = '<p>Customer session ID not found, cannot load transcript.</p>';
                            }

                        } catch (error) {
                            console.error("Error loading transcription:", error);
                            transcriptContent.innerHTML = `<p>Error loading transcription: ${error.message}</p>`;
                        }
                    }
                });
                transcriptionSection.appendChild(transcriptionHeader);
                detailsDiv.appendChild(transcriptionSection);


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
                            if (summaryData) {
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
                            } else {
                                summaryContent.innerHTML = '<p>No summaries available.</p>';
                            }
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
    console.log("GC interaction viewer - Starting application initialization");
    try {
        config = await getConfig();
        platformClient = await startGCSDKs(config.clientId);

        conversationsApi = new platformClient.ConversationsApi();
        journeyApi = new platformClient.JourneyApi();
        speechTextAnalyticsApi = new platformClient.SpeechTextAnalyticsApi();


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
            externalContactId = customerParticipant?.participantId;
        }


        const sessionsData = await fetchExternalContactSessions(externalContactId);
        console.log('sessionsData after fetchExternalContactSessions:', sessionsData);
        const relevantSessions = sessionsData.entities;
        console.log('relevantSessions after filter:', relevantSessions);

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
                mediaType: mediaType
            };
            sessionsByType[mediaType].push(sessionDisplayInfo);
        });

        console.log('sessionsByType:', sessionsByType);
        displayConversationHistory(sessionsByType);


    } catch (error) {
        console.error("GC interaction viewer - Initialization failed:", error);
        alert('Failed to initialize application: ' + error.message);
    }
}


document.addEventListener('DOMContentLoaded', initialize);
