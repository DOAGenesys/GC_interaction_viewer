let config = null;
let platformClient = null;
let conversationsApi = null;
let journeyApi = null;
let speechTextAnalyticsApi = null;
let allSessions = [];
let relevantSessions = [];


async function getConfig() {
    console.log("GC interaction viewer - Fetching configuration from /api/getConfig");
    try {
        const response = await fetch('/api/getConfig');
        if (!response.ok) {
            console.error("GC interaction viewer - Failed to fetch config, status:", response.status);
            throw new Error('Failed to get config');
        }
        console.log("GC interaction viewer - Successfully retrieved configuration");
        return response.json();
    } catch (error) {
        console.error("GC interaction viewer - Error fetching config:", error);
        displayErrorMessage('Failed to load configuration. Please check the console for details.');
        throw error;
    }
}

function getConversationId() {
    console.log("GC interaction viewer - Extracting conversation ID from URL parameters");
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversationId');
    console.log("GC interaction viewer - Conversation ID found:", conversationId || 'none');
    if (!conversationId) {
        displayErrorMessage('No conversation ID provided in the URL. Please provide a conversation ID to view details.');
    }
    return conversationId;
}

async function fetchConversationDetails(conversationId) {
    console.log(`GC interaction viewer - Fetching conversation details for ${conversationId}`);
    try {
        const conversationDetails = await conversationsApi.getAnalyticsConversationDetails(conversationId);
        return conversationDetails;
    } catch (error) {
        console.error("GC interaction viewer - Failed to fetch conversation details:", error);
        displayErrorMessage('Failed to fetch conversation details. Please check the console for details.');
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
        displayErrorMessage('Failed to fetch contact sessions. Please check the console for details.');
        throw new Error('Failed to fetch external contact sessions: ' + error.message);
    }
}

async function fetchTranscriptUrl(conversationId, communicationId) {
    try {
        const transcriptUrlData = await speechTextAnalyticsApi.getSpeechandtextanalyticsConversationCommunicationTranscripturl(conversationId, communicationId);
        return transcriptUrlData;
    } catch (error) {
        if (error.status === 404) {
            console.warn("Transcript URL not found (404) for conversation:", conversationId, "communication:", communicationId);
            return null;
        }
        console.error("GC interaction viewer - Failed to fetch transcript URL:", error);
        return null; // Return null instead of throwing error, handle null in fetchTranscriptData
    }
}

async function fetchTranscriptData(transcriptUrl, conversationId) {
    if (!transcriptUrl) return null; // Handle null transcriptUrl gracefully
    try {
        const response = await fetch(`/api/downloadTranscript?uri=${encodeURIComponent(transcriptUrl.url)}`, {
            headers: {
                'Authorization': `Bearer ${platformClient.ApiClient.instance.authData.accessToken}`
            }
        });
        if (!response.ok) {
            console.error("GC interaction viewer - Failed to fetch transcript data, status:", response.status, response.statusText, "for conversationId:", conversationId);
            return null; // Return null if fetch fails
        }
        return await response.json();
    } catch (error) {
        console.error("GC interaction viewer - Error fetching transcript data:", error, "for conversationId:", conversationId);
        return null; // Return null if json parsing or other error occurs
    }
}


async function fetchConversationSummary(conversationId) {
    try {
        const summaryData = await conversationsApi.getConversationSummaries(conversationId);
        return summaryData;
    } catch (error) {
        if (error.status === 404) {
            console.warn("Conversation summary not found (404) for conversation:", conversationId);
            return null;
        }
        console.error("GC interaction viewer - Failed to fetch conversation summary:", error);
        return null; // Return null instead of throwing error
    }
}

async function fetchConversationAnalytics(conversationId) {
    try {
        const analyticsData = await speechTextAnalyticsApi.getSpeechandtextanalyticsConversation(conversationId);
        return analyticsData;
    } catch (error) {
        if (error.status === 404) {
            console.warn("Conversation analytics not found (404) for conversation:", conversationId);
            return null;
        }
        console.error("GC interaction viewer - Failed to fetch conversation analytics:", error);
        return null; // Return null instead of throwing error
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
                } else if (mediaType !== 'Email') { // For Voice and Message
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
        console.log(`Session ID: ${session.id}, Event Name: ${eventName}`);

        if (eventName === "com.genesys.analytics.detailevents.FlowStartEvent" || eventName === "com.genesys.analytics.detailevents.AcdStartEvent" || eventName === "com.genesys.analytics.detailevents.FlowEndEvent") { // Modified logic to include FlowEndEvent
            console.log(`Session ${session.id} categorized as: Unattended`);
            return 'unattended';
        } else if (eventName === "com.genesys.analytics.detailevents.AcdEndEvent" || eventName === "com.genesys.analytics.detailevents.AfterCallWorkEvent") {
            console.log(`Session ${session.id} categorized as: Attended`);
            return 'attended';
        } else {
            console.log(`Session ${session.id} categorized as: Other`);
            return 'other';
        }
    }
    console.log(`Session ${session.id} categorized as: Other (No lastEvent or eventName)`);
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
    historyByTypeDiv.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle error-icon"></i> ${message}</div>`;
    historyByTypeDiv.style.display = 'block';
}


async function displayConversationHistory(sessionsByType) {
    console.log('displayConversationHistory called', sessionsByType);
    const historyByTypeDiv = document.getElementById('historyByType');
    historyByTypeDiv.innerHTML = '';

    if (Object.keys(sessionsByType).length === 0) {
        historyByTypeDiv.innerHTML = '<div class="no-sessions-message"><i class="fas fa-inbox-empty"></i> No conversations found for the selected criteria.</div>';
        historyByTypeDiv.style.display = 'block';
        return;
    }

    const statusFilterDropdown = $('#status-filter');
    const selectedStatuses = statusFilterDropdown.val() || [];


    for (const mediaType in sessionsByType) {
        console.log('Processing mediaType:', mediaType, sessionsByType[mediaType]);
        const mediaTypeSection = document.createElement('div');
        mediaTypeSection.classList.add('media-type-section', 'collapsed');

        const mediaTypeHeader = document.createElement('h4');
        mediaTypeHeader.textContent = `${mediaType} Conversations`;

        const expandButton = document.createElement('button');
        expandButton.innerHTML = '<i class="fas fa-expand-alt"></i> Expand';
        expandButton.classList.add('expand-collapse-button', 'expand-button');
        expandButton.addEventListener('click', () => {
            mediaTypeSection.classList.remove('collapsed');
            collapseButton.style.display = 'inline-block';
            expandButton.style.display = 'none';
        });

        const collapseButton = document.createElement('button');
        collapseButton.innerHTML = '<i class="fas fa-compress-alt"></i> Collapse';
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
         console.log('Sessions after filter:', sessions);

        console.log('Sessions for mediaType', mediaType, ':', sessions);
        if (!sessions || sessions.length === 0) {
            const noSessionsMessage = document.createElement('p');
            noSessionsMessage.textContent = `No ${mediaType} conversations found.`;
            mediaTypeSection.appendChild(noSessionsMessage);
        } else {
            const sessionsList = document.createElement('ul');
            for (const session of sessions) { // Changed forEach to for...of to use async/await properly
                console.log('Processing session:', session);
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
                transcriptionSection.classList.add('detail-section', 'collapsed');
                const transcriptionHeader = document.createElement('h5');
                transcriptionHeader.innerHTML = '<i class="fas fa-file-alt section-detail-icon"></i> Transcription <i class="fas fa-chevron-down expand-icon"></i><i class="fas fa-chevron-up collapse-icon"></i>';
                transcriptionHeader.classList.add('section-header');
                const transcriptionContent = document.createElement('div'); // Create content div here
                transcriptionContent.classList.add('section-content');
                transcriptionSection.appendChild(transcriptionContent); // Append it
                detailsDiv.appendChild(transcriptionSection);


                const summarySection = document.createElement('div');
                summarySection.classList.add('detail-section', 'collapsed');
                const summaryHeader = document.createElement('h5');
                summaryHeader.innerHTML = '<i class="fas fa-clipboard-check section-detail-icon"></i> Summary <i class="fas fa-chevron-down expand-icon"></i><i class="fas fa-chevron-up collapse-icon"></i>';
                summaryHeader.classList.add('section-header');
                const summaryContent = document.createElement('div'); // Create content div here
                summaryContent.classList.add('section-content');
                summarySection.appendChild(summaryContent); // Append it
                detailsDiv.appendChild(summarySection);

                const analyticsSection = document.createElement('div');
                analyticsSection.classList.add('detail-section', 'collapsed');
                const analyticsHeader = document.createElement('h5');
                analyticsHeader.innerHTML = '<i class="fas fa-chart-bar section-detail-icon"></i> Analytics <i class="fas fa-chevron-down expand-icon"></i><i class="fas fa-chevron-up collapse-icon"></i>';
                analyticsHeader.classList.add('section-header');
                const analyticsContent = document.createElement('div'); // Create content div here
                analyticsContent.classList.add('section-content');
                analyticsSection.appendChild(analyticsContent); // Append it
                detailsDiv.appendChild(analyticsSection);


                sessionItem.appendChild(detailsDiv);
                sessionsList.appendChild(sessionItem);

                // Pre-fetch data and store in sessionItem dataset
                let customerCommunicationIdForTranscript = null;
                try {
                    const conversationDetailsForTranscript = await fetchConversationDetails(session.id);
                    const customerParticipantForTranscript = conversationDetailsForTranscript.participants.find(p => p.purpose === 'customer' || p.purpose === 'external');
                    if (customerParticipantForTranscript && customerParticipantForTranscript.sessions && customerParticipantForTranscript.sessions.length > 0) {
                        customerCommunicationIdForTranscript = customerParticipantForTranscript.sessions[0].sessionId;
                    }
                } catch (error) {
                    console.error("Error fetching conversation details for transcript pre-fetch:", error);
                }


                const transcriptUrlData = await fetchTranscriptUrl(session.id, customerCommunicationIdForTranscript);
                const transcriptData = await fetchTranscriptData(transcriptUrlData, session.id);
                sessionItem.dataset.transcriptData = JSON.stringify(transcriptData); // Store fetched transcript data

                const summaryData = await fetchConversationSummary(session.id);
                sessionItem.dataset.summaryData = JSON.stringify(summaryData); // Store fetched summary data

                const analyticsData = await fetchConversationAnalytics(session.id);
                sessionItem.dataset.analyticsData = JSON.stringify(analyticsData); // Store fetched analytics data


                transcriptionHeader.addEventListener('click', () => {
                    transcriptionSection.classList.toggle('collapsed');
                    if (!transcriptionSection.dataset.contentLoaded) {
                        transcriptionSection.dataset.contentLoaded = 'true';
                        displayLoading(transcriptionContent);
                        const storedTranscriptData = JSON.parse(sessionItem.dataset.transcriptData);
                        if (storedTranscriptData) {
                            const transcriptHTML = processTranscript(storedTranscriptData, session.mediaType);
                            transcriptionContent.innerHTML = transcriptHTML;
                        } else {
                            transcriptionContent.innerHTML = '<p>No transcript data available.</p>';
                        }
                    }
                });


                summaryHeader.addEventListener('click', () => {
                    summarySection.classList.toggle('collapsed');
                    if (!summarySection.dataset.contentLoaded) {
                        summarySection.dataset.contentLoaded = 'true';
                        displayLoading(summaryContent);
                        const storedSummaryData = JSON.parse(sessionItem.dataset.summaryData);
                        if (storedSummaryData && storedSummaryData.summary) {
                             const summaryText = storedSummaryData.summary.text ? `<p><strong>Summary:</strong> ${storedSummaryData.summary.text}</p>` : '';
                                const reasonText = storedSummaryData.summary.reason && storedSummaryData.summary.reason.text ? `<p><strong>Reason:</strong> ${storedSummaryData.summary.reason.text}</p>` : '';
                                const followupText = storedSummaryData.summary.followup && storedSummaryData.summary.followup.text ? `<p><strong>Follow up:</strong> ${storedSummaryData.summary.followup.text}</p>` : '';
                                const resolutionText = storedSummaryData.summary.resolution && storedSummaryData.summary.resolution.text ? `<p><strong>Resolution:</strong> ${storedSummaryData.summary.resolution.text}</p>` : '';

                                summaryContent.innerHTML = `
                                    ${summaryText}
                                    ${reasonText}
                                    ${followupText}
                                    ${resolutionText}
                                `;
                        } else {
                            summaryContent.innerHTML = '<p>No summary data available.</p>';
                        }
                    }
                });

                analyticsHeader.addEventListener('click', () => {
                    analyticsSection.classList.toggle('collapsed');
                    if (!analyticsSection.dataset.contentLoaded) {
                        analyticsSection.dataset.contentLoaded = 'true';
                        displayLoading(analyticsContent);
                        const storedAnalyticsData = JSON.parse(sessionItem.dataset.analyticsData);
                        if (storedAnalyticsData) {
                            const analyticsDisplayHTML = displayConversationAnalytics(storedAnalyticsData);
                            analyticsContent.innerHTML = `<div class="analytics-grid">${analyticsDisplayHTML}</div>`;
                        } else {
                            analyticsContent.innerHTML = '<p>No analytics data available.</p>';
                        }
                    }
                });
            }
            mediaTypeSection.appendChild(sessionsList);
        }
        historyByTypeDiv.appendChild(mediaTypeSection);
    }
    historyByTypeDiv.style.display = 'block';
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
            return; // Stop initialization if no conversation ID
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


        relevantSessions = allSessions.filter(session => {
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
                messageType: session.conversationChannels[0].messageType,
                lastEvent: session.lastEvent
            };
            sessionsByType[mediaType].push(sessionDisplayInfo);
        });

        console.log('sessionsByType:', sessionsByType);
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
        console.error("GC interaction viewer - Initialization failed:", error);
        displayErrorMessage('Failed to initialize application. Please check the console for details.');
    }
}


document.addEventListener('DOMContentLoaded', initialize);
