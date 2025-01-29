let config = null;
let platformClient = null;
let conversationsApi = null;
let journeyApi = null;
let speechTextAnalyticsApi = null;
let allSessions = [];
let relevantSessions = [];


async function getConfig() {
    console.log("GC Interaction Viewer - Fetching configuration from /api/getConfig");
    try {
        const response = await fetch('/api/getConfig');
        if (!response.ok) {
            console.error("GC Interaction Viewer - Failed to fetch config, status:", response.status);
            throw new Error('Failed to get config');
        }
        console.log("GC Interaction Viewer - Successfully retrieved configuration");
        return response.json();
    } catch (error) {
        console.error("GC Interaction Viewer - Error fetching config:", error);
        displayErrorMessage('Failed to load configuration. Please check the console for details.');
        throw error;
    }
}

function getConversationId() {
    console.log("GC Interaction Viewer - Extracting conversation ID from URL parameters");
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversationId');
    console.log("GC Interaction Viewer - Conversation ID found:", conversationId || 'none');
    if (!conversationId) {
        displayErrorMessage('No conversation ID provided in the URL. Please provide a conversation ID to view details.');
    }
    return conversationId;
}

async function fetchConversationDetails(conversationId) {
    console.log(`GC Interaction Viewer - Fetching conversation details for ${conversationId}`);
    try {
        const conversationDetails = await conversationsApi.getAnalyticsConversationDetails(conversationId);
        return conversationDetails;
    } catch (error) {
        console.error("GC Interaction Viewer - Failed to fetch conversation details:", error);
        displayErrorMessage('Failed to fetch conversation details. Please check the console for details.');
        throw new Error('Failed to fetch conversation details: ' + error.message);
    }
}

async function fetchExternalContactSessions(contactId) {
    console.log(`GC Interaction Viewer - Fetching external contact sessions for ${contactId}`);
    let opts = {
        "includeMerged": true
    };
    try {
        const sessionsData = await journeyApi.getExternalcontactsContactJourneySessions(contactId, opts);
        return sessionsData;
    } catch (error) {
        console.error("GC Interaction Viewer - Failed to fetch external contact sessions:", error);
        displayErrorMessage('Failed to fetch contact sessions. Please check the console for details.');
        throw new Error('Failed to fetch external contact sessions: ' + error.message);
    }
}

async function fetchTranscriptUrl(conversationId, communicationId) {
    console.log(`GC Interaction Viewer - Fetching transcript URL for conversation ${conversationId}, communication ${communicationId}`);
    try {
        const transcriptUrlData = await speechTextAnalyticsApi.getSpeechandtextanalyticsConversationCommunicationTranscripturl(conversationId, communicationId);
        return transcriptUrlData;
    } catch (error) {
        if (error.status === 404) {
            GC Interaction Viewer - console.warn("GC Interaction Viewer - Transcript URL not found (404) for conversation:", conversationId, "communication:", communicationId);
            return null;
        }
        console.error("GC Interaction Viewer - Failed to fetch transcript URL:", error);
        displayErrorMessage('Failed to fetch transcript URL. Please check the console for details.');
        throw new Error('Failed to fetch transcript URL: ' + error.message);
    }
}

async function fetchTranscriptData(transcriptUrl) {
    console.log(`GC Interaction Viewer - Fetching transcript data from URL via /api/downloadTranscript`);
    try {
        const response = await fetch(`/api/downloadTranscript?uri=${encodeURIComponent(transcriptUrl.url)}`, {
            headers: {
                'Authorization': `Bearer ${platformClient.ApiClient.instance.authData.accessToken}`
            }
        });
        if (!response.ok) {
            console.error("GC Interaction Viewer - Failed to fetch transcript data, status:", response.status);
            throw new Error(`Failed to fetch transcript data: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("GC Interaction Viewer - Error fetching transcript data:", error);
        displayErrorMessage('Error fetching transcript data. Please check the console for details.');
        throw new Error('Error fetching transcript data: ' + error.message);
    }
}


async function fetchConversationSummary(conversationId) {
    console.log(`GC Interaction Viewer - Fetching conversation summary for ${conversationId}`);
    try {
        const summaryData = await conversationsApi.getConversationSummaries(conversationId);
        return summaryData;
    } catch (error) {
        if (error.status === 404) {
            GC Interaction Viewer - console.warn("GC Interaction Viewer - Conversation summary not found (404) for conversation:", conversationId);
            return null;
        }
        console.error("GC Interaction Viewer - Failed to fetch conversation summary:", error);
        displayErrorMessage('Failed to fetch conversation summary. Please check the console for details.');
        throw new Error('Failed to fetch conversation summary: ' + error.message);
    }
}

async function fetchConversationAnalytics(conversationId) {
    console.log(`GC Interaction Viewer - Fetching conversation analytics for ${conversationId}`);
    try {
        const analyticsData = await speechTextAnalyticsApi.getSpeechandtextanalyticsConversation(conversationId);
        return analyticsData;
    } catch (error) {
        if (error.status === 404) {
            GC Interaction Viewer - console.warn("GC Interaction Viewer - Conversation analytics not found (404) for conversation:", conversationId);
            return null;
        }
        console.error("GC Interaction Viewer - Failed to fetch conversation analytics:", error);
        displayErrorMessage('Failed to fetch conversation analytics. Please check the console for details.');
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
                    transcriptHTML += `<p class="transcript-subject"><strong>Subject:</strong> ${text}</p>`;
                } else if (mediaType === 'Email' && phrase.type === 'body') {
                    transcriptHTML += `<p class="transcript-body">${text}</p>`;
                } else if (mediaType !== 'Email') {
                    if (participantPurpose !== currentParticipant) {
                        transcriptHTML += `<p class="transcript-speaker"><strong>${participantPurpose.toUpperCase()}:</strong></p><p class="transcript-text">${text}</p>`;
                        currentParticipant = participantPurpose;
                    } else {
                        transcriptHTML += `<p class="transcript-text">${text}</p>`;
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
            <div class="analytics-item"><strong>Sentiment Score:</strong> ${sentimentScorePercentage}%</div>
            <div class="analytics-item"><strong>Sentiment Trend:</strong> ${sentimentTrendPercentage}</div>
        `;


        if (analyticsData.empathyScores && analyticsData.empathyScores.length > 0) {
            analyticsData.empathyScores.forEach(empathyScore => {
                analyticsHTML += `<div class="analytics-item"><strong>Empathy Score (User ${empathyScore.userId}):</strong> ${empathyScore.score}%</div>`;
            });
        } else {
            analyticsHTML += `<div class="analytics-item"><strong>Empathy Score:</strong> N/A</div>`;
        }
    } else {
        analyticsHTML = '<p>No analytics data available.</p>';
    }
    return analyticsHTML;
}


function getSessionStatus(session) {
    if (session.lastEvent && session.lastEvent.eventName) {
        const eventName = session.lastEvent.eventName;
        console.log(`GC Interaction Viewer - Session ID: ${session.id}, Event Name: ${eventName}`);

        if (eventName === "com.genesys.analytics.detailevents.FlowStartEvent" || eventName === "com.genesys.analytics.detailevents.AcdStartEvent" || eventName === "com.genesys.analytics.detailevents.FlowEndEvent") {
            console.log(`GC Interaction Viewer - Session ${session.id} categorized as: Unattended`);
            return 'unattended';
        } else if (eventName === "com.genesys.analytics.detailevents.AcdEndEvent" || eventName === "com.genesys.analytics.detailevents.AfterCallWorkEvent") {
            console.log(`GC Interaction Viewer - Session ${session.id} categorized as: Attended`);
            return 'attended';
        } else {
            console.log(`GC Interaction Viewer - Session ${session.id} categorized as: Other`);
            return 'other';
        }
    }
    console.log(`GC Interaction Viewer - Session ${session.id} categorized as: Other (No lastEvent or eventName)`);
    return 'other';
}


function applyStatusFilter(sessions, selectedStatuses) {
    if (!selectedStatuses || selectedStatuses.length === 0 || selectedStatuses.includes('all')) {
        return sessions;
    }

    return sessions.filter(session => {
        const sessionStatus = getSessionStatus(session);
        return selectedStatuses.includes(sessionStatus);
    });
}

function displayLoading(sectionContent) {
    sectionContent.innerHTML = '<div class="loading-spinner"></div><p class="loading-text">Loading...</p>';
}

function displayErrorMessage(message) {
    const historyByTypeDiv = document.getElementById('historyByType');
    historyByTypeDiv.innerHTML = `<div class="error-message">⚠ ${message}</div>`;
    historyByTypeDiv.style.display = 'block';
}


async function displayConversationHistory(sessionsByType) {
    console.log('GC Interaction Viewer - displayConversationHistory called', sessionsByType);
    const historyByTypeDiv = document.getElementById('historyByType');
    historyByTypeDiv.innerHTML = '';

    if (Object.keys(sessionsByType).length === 0) {
        historyByTypeDiv.innerHTML = '<div class="no-sessions-message">📥 No conversations found for the selected criteria.</div>';
        historyByTypeDiv.style.display = 'block';
        return;
    }

    const statusFilterDropdown = $('#status-filter');
    const selectedStatuses = statusFilterDropdown.val() || [];


    for (const mediaType in sessionsByType) {
        console.log('GC Interaction Viewer - Processing mediaType:', mediaType, sessionsByType[mediaType]);
        const mediaTypeSection = document.createElement('div');
        mediaTypeSection.classList.add('media-type-section');
        mediaTypeSection.classList.add('collapsed');

        const mediaTypeHeader = document.createElement('h4');
        mediaTypeHeader.textContent = `${mediaType} Conversations`;

        const expandButton = document.createElement('button');
        expandButton.innerHTML = '↗ Expand';
        expandButton.classList.add('expand-collapse-button', 'expand-button');
        expandButton.addEventListener('click', () => {
            mediaTypeSection.classList.remove('collapsed');
            collapseButton.style.display = 'inline-block';
            expandButton.style.display = 'none';
        });

        const collapseButton = document.createElement('button');
        collapseButton.innerHTML = '↙ Collapse';
        collapseButton.classList.add('expand-collapse-button', 'collapse-button');
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
         console.log('GC Interaction Viewer - Sessions after filter:', sessions);

        console.log('GC Interaction Viewer - Sessions for mediaType', mediaType, ':', sessions);
        if (!sessions || sessions.length === 0) {
            const noSessionsMessage = document.createElement('p');
            noSessionsMessage.textContent = `No ${mediaType} conversations found.`;
            mediaTypeSection.appendChild(noSessionsMessage);
        } else {
            const sessionsList = document.createElement('ul');
            sessions.forEach(session => {
                console.log('GC Interaction Viewer - Processing session:', session);
                const sessionItem = document.createElement('li');
                sessionItem.classList.add('session-item');

                const sessionHeader = document.createElement('div');
                sessionHeader.classList.add('session-header');
                let subjectOrType = '';
                 if (session.mediaType === 'Email' && session.conversationSubject) {
                    subjectOrType = `<span class="session-subject">Subject: ${session.conversationSubject}</span>`;
                } else if (session.mediaType === 'Message' && session.messageType) {
                    subjectOrType = `<span class="session-type">Type: ${session.messageType}</span>`;
                }
                const createdDate = new Date(session.createdDate);
                const formattedCreatedDate = createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                sessionHeader.innerHTML = `
                    <a href="https://apps.${window.environment}/directory/#/analytics/interactions/${session.id}/admin" target="_blank" class="conversation-id-link">${session.id}</a>
                    <span class="session-direction">${session.originatingDirection}</span>
                     <span class="session-date">${formattedCreatedDate}</span>
                    ${subjectOrType}
                `;
                sessionItem.appendChild(sessionHeader);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('session-details');

                const transcriptionSection = document.createElement('div');
                transcriptionSection.classList.add('detail-section');
                const transcriptionHeader = document.createElement('h5');
                transcriptionHeader.innerHTML = '📄 Transcription <span class="expand-icon">▼</span><span class="collapse-icon">▲</span>';
                transcriptionHeader.classList.add('section-header');
                transcriptionHeader.addEventListener('click', async () => {
                    console.log("GC Interaction Viewer - Transcription header clicked for session:", session.id);
                    transcriptionSection.classList.toggle('collapsed');
                    const sectionContent = transcriptionSection.querySelector('.section-content');
                    if (!transcriptionSection.dataset.transcriptLoaded) {
                        console.log("GC Interaction Viewer - Transcript not loaded yet, proceeding to load for session:", session.id);
                        transcriptionSection.dataset.transcriptLoaded = 'true';
                        displayLoading(sectionContent);
                        transcriptionContent.innerHTML = '<p>Loading Transcription...</p>';

                        try {
                            console.log("GC Interaction Viewer - Fetching conversation details for transcript: ", session.id);
                            const conversationDetailsForTranscript = await fetchConversationDetails(session.id);
                            console.log("GC Interaction Viewer - Conversation details fetched successfully for transcript:", session.id, conversationDetailsForTranscript);

                            let customerCommunicationIdForTranscript = null;
                            const customerParticipantForTranscript = conversationDetailsForTranscript.participants.find(p => p.purpose === 'customer' || p.purpose === 'external');
                            if (customerParticipantForTranscript && customerParticipantForTranscript.sessions && customerParticipantForTranscript.sessions.length > 0) {
                                customerCommunicationIdForTranscript = customerParticipantForTranscript.sessions[0].sessionId;
                            }

                            if (customerCommunicationIdForTranscript) {
                                console.log("GC Interaction Viewer - Customer communication ID found:", customerCommunicationIdForTranscript, "Fetching transcript URL for conversation:", session.id, "communication:", customerCommunicationIdForTranscript);
                                const transcriptUrlData = await fetchTranscriptUrl(session.id, customerCommunicationIdForTranscript);
                                console.log("GC Interaction Viewer - Transcript URL data fetched:", transcriptUrlData);
                                if (transcriptUrlData) {
                                    console.log("GC Interaction Viewer - Transcript URL available:", transcriptUrlData.url, "Fetching transcript data...");
                                    const transcriptData = await fetchTranscriptData(transcriptUrlData);
                                    console.log("GC Interaction Viewer - Transcript data fetched successfully:", transcriptData);
                                    const transcriptHTML = processTranscript(transcriptData, session.mediaType);
                                    transcriptContent.innerHTML = transcriptHTML;
                                    console.log("GC Interaction Viewer - Transcript HTML content rendered.");
                                } else {
                                    transcriptContent.innerHTML = '<p>No transcriptions available for this conversation.</p>';
                                    GC Interaction Viewer - console.warn("GC Interaction Viewer - No transcript URL data returned for conversation:", session.id, "communication:", customerCommunicationIdForTranscript);
                                }
                            } else {
                                transcriptContent.innerHTML = '<p>Customer session ID not found, cannot load transcript.</p>';
                                GC Interaction Viewer - console.warn("GC Interaction Viewer - Customer session ID not found for conversation:", session.id);
                            }

                        } catch (error) {
                            console.error("GC Interaction Viewer - Error loading transcription:", error);
                            transcriptContent.innerHTML = `<div class="error-message-inline">⚠ Error loading transcription: ${error.message}</div>`;
                        }
                    }
                });
                const transcriptionContent = document.createElement('div');
                transcriptionContent.classList.add('section-content');
                transcriptionSection.appendChild(transcriptionContent);
                detailsDiv.appendChild(transcriptionSection);


                const summarySection = document.createElement('div');
                summarySection.classList.add('detail-section');
                const summaryHeader = document.createElement('h5');
                summaryHeader.innerHTML = 'Summary <span class="expand-icon">▼</span><span class="collapse-icon">▲</span>';
                summaryHeader.classList.add('section-header');

                summaryHeader.addEventListener('click', async () => {
                    console.log("GC Interaction Viewer - Summary header clicked for session:", session.id);
                    summarySection.classList.toggle('collapsed');
                    const sectionContent = summarySection.querySelector('.section-content');
                    if (!summarySection.dataset.summaryLoaded) {
                        console.log("GC Interaction Viewer - Summary not loaded yet, proceeding to load for session:", session.id);
                        summarySection.dataset.summaryLoaded = 'true';
                        displayLoading(sectionContent);
                        summaryContent.innerHTML = '<p>Loading Summary...</p>';

                        try {
                            console.log("GC Interaction Viewer - Fetching conversation summary for session:", session.id);
                            const summaryData = await fetchConversationSummary(session.id);
                            console.log("GC Interaction Viewer - Summary data fetched:", summaryData);
                            if (summaryData && summaryData.summary) {
                                const summaryText = summaryData.summary.text ? `<p><strong>Summary:</strong> ${summaryData.summary.text}</p>` : '';
                                const reasonText = summaryData.summary.reason && summaryData.summary.reason.text ? `<p><strong>Reason:</strong> ${summaryData.summary.reason.text}</p>` : '';
                                const followupText = summaryData.summary.followup && summaryData.summary.followup.text ? `<p><strong>Follow up:</strong> ${summaryData.summary.followup.text}</p>` : '';
                                const resolutionText = summaryData.summary.resolution && summaryData.summary.resolution.text ? `<p><strong>Resolution:</strong> ${summaryData.summary.resolution.text}</p>` : '';

                                summaryContent.innerHTML = `
                                    ${summaryText}
                                    ${reasonText}
                                    ${followupText}
                                    ${resolutionText}
                                `;
                                console.log("GC Interaction Viewer - Summary HTML content rendered.");
                            } else {
                                summaryContent.innerHTML = '<p>No summaries available for this conversation.</p>';
                                GC Interaction Viewer - console.warn("GC Interaction Viewer - No summary data returned for conversation:", session.id);
                            }
                        } catch (error) {
                            console.error("GC Interaction Viewer - Error loading summary:", error);
                            summaryContent.innerHTML = `<div class="error-message-inline">⚠ Error loading summary: ${error.message}</div>`;
                        }
                    }
                });
                const summaryContent = document.createElement('div');
                summaryContent.classList.add('section-content');
                summarySection.appendChild(summaryContent);
                detailsDiv.appendChild(summarySection);


                const analyticsSection = document.createElement('div');
                analyticsSection.classList.add('detail-section');
                const analyticsHeader = document.createElement('h5');
                analyticsHeader.innerHTML = 'Analytics <span class="expand-icon">▼</span><span class="collapse-icon">▲</span>';
                analyticsHeader.classList.add('section-header');

                analyticsHeader.addEventListener('click', async () => {
                    console.log("GC Interaction Viewer - Analytics header clicked for session:", session.id);
                    analyticsSection.classList.toggle('collapsed');
                    const sectionContent = analyticsSection.querySelector('.section-content');
                    if (!analyticsSection.dataset.analyticsLoaded) {
                        console.log("GC Interaction Viewer - Analytics not loaded yet, proceeding to load for session:", session.id);
                        analyticsSection.dataset.analyticsLoaded = 'true';
                        displayLoading(sectionContent);
                        analyticsContent.innerHTML = '<p>Loading Analytics...</p>';
                        try {
                            console.log("GC Interaction Viewer - Fetching conversation analytics for session:", session.id);
                            const analyticsData = await fetchConversationAnalytics(session.id);
                            console.log("GC Interaction Viewer - Analytics data fetched:", analyticsData);
                            if (analyticsData) {
                                const analyticsDisplayHTML = displayConversationAnalytics(analyticsData);
                                analyticsContent.innerHTML = `<div class="analytics-grid">${analyticsDisplayHTML}</div>`;
                                console.log("GC Interaction Viewer - Analytics HTML content rendered.");
                            } else {
                                analyticsContent.innerHTML = '<p>No analytics data available for this conversation.</p>';
                                GC Interaction Viewer - console.warn("GC Interaction Viewer - No analytics data returned for conversation:", session.id);
                            }
                        } catch (error) {
                            console.error("GC Interaction Viewer - Error loading analytics:", error);
                            analyticsContent.innerHTML = `<div class="error-message-inline">⚠ Error loading analytics: ${error.message}</div>`;
                        }
                    }
                });
                const analyticsContent = document.createElement('div');
                analyticsContent.classList.add('section-content');
                analyticsSection.appendChild(analyticsContent);
                detailsDiv.appendChild(analyticsSection);


                sessionItem.appendChild(detailsDiv);
                sessionsList.appendChild(sessionItem);
            });
            mediaTypeSection.appendChild(sessionsList);
        }
        historyByTypeDiv.appendChild(mediaTypeSection);
    }
    historyByTypeDiv.style.display = 'block';
}

async function initialize() {
    console.log("GC Interaction Viewer - Starting application initialization");
    try {
        config = await getConfig();
        platformClient = await startGCSDKs(config.clientId);

        conversationsApi = new platformClient.ConversationsApi();
        journeyApi = new platformClient.JourneyApi();
        speechTextAnalyticsApi = new platformClient.SpeechTextAnalyticsApi();


        const conversationId = getConversationId();
        if (!conversationId) {
            return;
        }

        const conversationDetails = await fetchConversationDetails(conversationId);

        let externalContactId = null;
        const customerParticipant = conversationDetails.participants.find(p => p.purpose === 'customer' || p.purpose === 'external');
        if (customerParticipant && customerParticipant.externalContactId) {
            externalContactId = customerParticipant.externalContactId;
        } else {
            GC Interaction Viewer - console.warn("GC Interaction Viewer - Customer or external contact ID not found, using default.");
            externalContactId = customerParticipant?.participantId;
        }


        const sessionsData = await fetchExternalContactSessions(externalContactId);
        console.log('GC Interaction Viewer - sessionsData after fetchExternalContactSessions:', sessionsData);
         allSessions = sessionsData.entities;


        relevantSessions = allSessions.filter(session => {
            if (!session.conversationChannels || session.conversationChannels.length === 0) {
                return false;
            }
            const mediaType = session.conversationChannels[0].type;
            return ['Voice', 'Message', 'Email'].includes(mediaType);
        });


        console.log('GC Interaction Viewer - relevantSessions after filter:', relevantSessions);

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
                messageType: session.conversationChannels[0].messageType,
                lastEvent: session.lastEvent
            };
            sessionsByType[mediaType].push(sessionDisplayInfo);
        });

        console.log('GC Interaction Viewer - sessionsByType:', sessionsByType);
        displayConversationHistory(sessionsByType);


         $('#status-filter').select2({
            placeholder: "Select statuses",
            allowClear: true,
            width: '100%'
         });

        $('#status-filter').on('change', function () {

             const selectedStatuses = $(this).val();
             const filteredSessions = applyStatusFilter(relevantSessions, selectedStatuses);

             const sessionsByType = {};
             filteredSessions.forEach(session => {
                 if (!session.conversationChannels || !Array.isArray(session.conversationChannels) || session.conversationChannels.length === 0) {
                    return;
                 }
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
                    messageType: session.conversationChannels[0].messageType,
                    lastEvent: session.lastEvent
                };
                sessionsByType[mediaType].push(sessionDisplayInfo);
            });

            displayConversationHistory(sessionsByType);
        });


    } catch (error) {
        console.error("GC Interaction Viewer - Initialization failed:", error);
        displayErrorMessage('Failed to initialize application. Please check the console for details.');
    }
}


document.addEventListener('DOMContentLoaded', initialize);
