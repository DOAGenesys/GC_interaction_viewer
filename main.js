let config = null;
let platformClient = null;
let conversationsApi = null;
let journeyApi = null;
let speechTextAnalyticsApi = null;
let allSessions = [];


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
        "includeMerged": true
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

async function fetchConversationAnalytics(conversationId) {
    console.log(`GC interaction viewer - Fetching conversation analytics for ${conversationId}`);
    try {
        const analyticsData = await speechTextAnalyticsApi.getSpeechandtextanalyticsConversation(conversationId);
        return analyticsData;
    } catch (error) {
        if (error.status === 404) {
            console.warn("Conversation analytics not found (404) for conversation:", conversationId);
            return null;
        }
        console.error("GC interaction viewer - Failed to fetch conversation analytics:", error);
        throw new Error('Failed to fetch conversation analytics: ' + error.message);
    }
}


function processTranscript(transcriptJson, mediaType) {
    if (!transcriptJson || !transcriptJson.transcripts || transcriptJson.transcripts.length === 0) {
        return "<p>No transcript available.</p>";
    }

    let transcriptHTML = '';
    let topics = new Set();

    transcriptJson.transcripts.forEach(transcript => {
        if (transcript.phrases) {
            let currentParticipant = null;
            transcript.phrases.forEach(phrase => {
                const participantPurpose = phrase.participantPurpose || 'unknown';
                const text = phrase.text;

                if (mediaType === 'Email' && phrase.type === 'subject') {
                    transcriptHTML += `<p><strong>Subject:</strong> ${text}</p>`;
                } else if (mediaType === 'Email' && phrase.type === 'body') {
                    transcriptHTML += `<p>${text}</p>`;
                } else if (mediaType !== 'Email') { // For Voice and Message
                    if (participantPurpose !== currentParticipant) {
                        transcriptHTML += `<p><strong>${participantPurpose.toUpperCase()}:</strong> ${text}</p>`;
                        currentParticipant = participantPurpose;
                    } else {
                        transcriptHTML += `<p>${text}</p>`;
                    }
                }
            });
        }

        if (transcript.analytics && transcript.analytics.topics) {
            transcript.analytics.topics.forEach(topic => {
                topics.add(topic.topicName);
            });
        }
    });

    let analyticsHTML = '';
    if (topics.size > 0) {
        const topicsArray = Array.from(topics);
        const topicsTags = topicsArray.map(topic => `<span class="topic-tag">${topic}</span>`).join('');
        analyticsHTML += `
            <div class="topics-section">
                <h6 class="topics-header">Topics:</h6>
                <div class="topic-tags-container">${topicsTags}</div>
            </div>
        `;
    }
    return transcriptHTML + analyticsHTML;
}


function displayConversationAnalytics(analyticsData) {
    let analyticsHTML = '';
    if (analyticsData) {
        const sentimentScorePercentage = (analyticsData.sentimentScore * 100).toFixed(2);
        const sentimentTrendPercentage = analyticsData.sentimentTrendClass === 'NotCalculated' ? 'N/A' : (analyticsData.sentimentTrend * 100).toFixed(2) + '%';
        analyticsHTML += `
            <p><strong>Sentiment Score:</strong> ${sentimentScorePercentage}%</p>
            <p><strong>Sentiment Trend:</strong> ${sentimentTrendPercentage}</p>
        `;


        if (analyticsData.empathyScores && analyticsData.empathyScores.length > 0) {
            analyticsData.empathyScores.forEach(empathyScore => {
                analyticsHTML += `<p><strong>Empathy Score (User ${empathyScore.userId}):</strong> ${empathyScore.score}%</p>`;
            });
        } else {
            analyticsHTML += `<p><strong>Empathy Score:</strong> N/A</p>`;
        }
    } else {
        analyticsHTML = '<p>No analytics data available.</p>';
    }
    return analyticsHTML;
}


function applyStatusFilter(sessions, selectedStatuses) {
    if (!selectedStatuses || selectedStatuses.length === 0 || selectedStatuses.includes('all')) {
        return sessions;
    }

    return sessions.filter(session => {
        let sessionStatus = 'other'; // Default status

        if (session.lastEvent && session.lastEvent.eventName) {
            const eventName = session.lastEvent.eventName;
             if (eventName === "com.genesys.analytics.detailevents.FlowStartEvent" || eventName === "com.genesys.analytics.detailevents.AcdStartEvent") {
                 sessionStatus = 'unattended';
             } else if (eventName === "com.genesys.analytics.detailevents.AcdEndEvent" || eventName === "com.genesys.analytics.detailevents.AfterCallWorkEvent") {
                 sessionStatus = 'attended';
             }

        }

        return selectedStatuses.includes(sessionStatus);
    });
}


async function displayConversationHistory(sessionsByType) {
    console.log('displayConversationHistory called', sessionsByType);
    const historyByTypeDiv = document.getElementById('historyByType');
    historyByTypeDiv.innerHTML = '';

    const statusFilterDropdown = $('#status-filter');
    const selectedStatuses = statusFilterDropdown.val() || [];


    for (const mediaType in sessionsByType) {
        console.log('Processing mediaType:', mediaType, sessionsByType[mediaType]);
        const mediaTypeSection = document.createElement('div');
        mediaTypeSection.classList.add('media-type-section', 'collapsed');

        const mediaTypeHeader = document.createElement('h4');
        mediaTypeHeader.textContent = `${mediaType} Conversations`;

        const expandButton = document.createElement('button');
        expandButton.textContent = 'Expand';
        expandButton.classList.add('expand-collapse-button');
        expandButton.addEventListener('click', () => {
            mediaTypeSection.classList.remove('collapsed');
            collapseButton.style.display = 'inline-block';
            expandButton.style.display = 'none';
        });

        const collapseButton = document.createElement('button');
        collapseButton.textContent = 'Collapse';
        collapseButton.classList.add('expand-collapse-button');
        collapseButton.style.display = 'none';
         collapseButton.addEventListener('click', () => {
            mediaTypeSection.classList.add('collapsed');
            expandButton.style.display = 'inline-block';
            collapseButton.style.display = 'none';
        });


        const headerContainer = document.createElement('div');
        headerContainer.classList.add('media-type-header-container');
        headerContainer.appendChild(mediaTypeHeader);
        headerContainer.appendChild(expandButton);
        headerContainer.appendChild(collapseButton);
        mediaTypeSection.appendChild(headerContainer);



        let sessions = sessionsByType[mediaType];

        sessions = applyStatusFilter(sessions, selectedStatuses);
         console.log('Sessions after filter:', sessions);

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
                let subjectOrType = '';
                 if (session.mediaType === 'Email' && session.conversationSubject) {
                    subjectOrType = `<span>Subject: ${session.conversationSubject}</span>`;
                } else if (session.mediaType === 'Message' && session.messageType) {
                    subjectOrType = `<span>Type: ${session.messageType}</span>`;
                }
                const createdDate = new Date(session.createdDate);
                const formattedCreatedDate = createdDate.toLocaleString();

                sessionHeader.innerHTML = `
                    <a href="https://apps.${window.environment}/directory/#/analytics/interactions/${session.id}/admin" target="_blank" class="conversation-id-link">${session.id}</a>
                    <span>${session.originatingDirection}</span>
                     <span>${formattedCreatedDate}</span>
                    ${subjectOrType}
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
                                    const transcriptHTML = processTranscript(transcriptData, session.mediaType);
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


                const analyticsSection = document.createElement('div');
                analyticsSection.classList.add('detail-section', 'collapsed');
                const analyticsHeader = document.createElement('h5');
                analyticsHeader.textContent = 'Analytics';
                analyticsHeader.classList.add('section-header');

                analyticsHeader.addEventListener('click', async () => {
                    analyticsSection.classList.toggle('collapsed');
                    if (!analyticsSection.dataset.analyticsLoaded) {
                        analyticsSection.dataset.analyticsLoaded = 'true';
                        const analyticsContent = document.createElement('div');
                        analyticsContent.classList.add('section-content');
                        analyticsContent.innerHTML = '<p>Loading analytics...</p>';
                        analyticsSection.appendChild(analyticsContent);

                        try {
                            const analyticsData = await fetchConversationAnalytics(session.id);
                            if (analyticsData) {
                                const analyticsDisplayHTML = displayConversationAnalytics(analyticsData);
                                analyticsContent.innerHTML = analyticsDisplayHTML;
                            } else {
                                analyticsContent.innerHTML = '<p>No analytics data available.</p>';
                            }
                        } catch (error) {
                            console.error("Error loading analytics:", error);
                            analyticsContent.innerHTML = `<p>Error loading analytics: ${error.message}</p>`;
                        }
                    }
                });
                analyticsSection.appendChild(analyticsHeader);
                detailsDiv.appendChild(analyticsSection);


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
         allSessions = sessionsData.entities;


        let relevantSessions = allSessions;

        relevantSessions = relevantSessions.filter(session => {
            if (!session.conversationChannels || session.conversationChannels.length === 0) {
                return false;
            }
            const mediaType = session.conversationChannels[0].type;
            return ['Voice', 'Message', 'Email'].includes(mediaType);
        });


        console.log('relevantSessions after filter:', relevantSessions);

        const sessionsByType = {};
        relevantSessions.forEach(session => {
            const mediaType = session.conversationChannels[0].type;
            if (!sessionsByType[mediaType]) {
                sessionsByType[mediaType] = [];
            }
            const sessionDisplayInfo = {
                id: session.id,
                originatingDirection: session.originatingDirection,
                conversationSubject: session.conversationSubject,
                createdDate: session.createdDate,
                mediaType: mediaType,
                messageType: session.conversationChannels[0].messageType, // Add messageType
                lastEvent: session.lastEvent
            };
            sessionsByType[mediaType].push(sessionDisplayInfo);
        });

        console.log('sessionsByType:', sessionsByType);
        displayConversationHistory(sessionsByType);


         $('#status-filter').select2({
            placeholder: "Select a status",
            allowClear: true
         });

        $('#status-filter').on('change', function () {

             const selectedStatuses = $(this).val();
             const filteredSessions = applyStatusFilter(allSessions, selectedStatuses);

             const sessionsByType = {};
             filteredSessions.forEach(session => {
                const mediaType = session.conversationChannels[0].type;
                if (!sessionsByType[mediaType]) {
                    sessionsByType[mediaType] = [];
                }
                const sessionDisplayInfo = {
                    id: session.id,
                    originatingDirection: session.originatingDirection,
                    conversationSubject: session.conversationSubject,
                    createdDate: session.createdDate,
                    mediaType: mediaType,
                    messageType: session.conversationChannels[0].messageType, // Add messageType
                    lastEvent: session.lastEvent
                };
                sessionsByType[mediaType].push(sessionDisplayInfo);
            });

            displayConversationHistory(sessionsByType);
        });


    } catch (error) {
        console.error("GC interaction viewer - Initialization failed:", error);
        alert('Failed to initialize application: ' + error.message);
    }
}


document.addEventListener('DOMContentLoaded', initialize);
