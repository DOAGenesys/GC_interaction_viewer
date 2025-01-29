let config = null;
let platformClient = null;
let conversationsApi = null;
let journeyApi = null;
let speechTextAnalyticsApi = null;
let allSessions = [];
let relevantSessions = [];
const MAX_RETRIES = 3;

async function callApi(apiFunction, apiArgs, retryCount = 0) {
    try {
        const response = await apiFunction(...apiArgs);
        return response;
    } catch (error) {
        if (error.status === 429 || error.status === 502 || error.status === 503 || error.status === 504) {
            if (retryCount < MAX_RETRIES) {
                let retryAfter = 0;
                if (error.status === 429 && error.headers && error.headers['retry-after']) {
                    retryAfter = parseInt(error.headers['retry-after'], 10);
                } else {
                    const backoffTimes = [3, 9, 27];
                    retryAfter = backoffTimes[retryCount] || 27;
                }
                console.warn(`Rate limit encountered, retrying after ${retryAfter} seconds. Retry count: ${retryCount + 1}`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return callApi(apiFunction, apiArgs, retryCount + 1);
            } else {
                console.error(`Max retries reached for API call after rate limiting.`, error);
                throw error;
            }
        } else {
            throw error;
        }
    }
}

async function getConfig() {
    try {
        const response = await fetch('/api/getConfig');
        if (!response.ok) {
            console.error(`GC Interaction Viewer - Failed to fetch config, status:`, response.status);
            throw new Error('Failed to get config');
        }
        return response.json();
    } catch (error) {
        console.error(`GC Interaction Viewer - Error fetching config:`, error);
        displayErrorMessage('Failed to load configuration. Please check the console for details.');
        throw error;
    }
}

function getConversationId() {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversationId');
    if (!conversationId) {
        displayErrorMessage('No conversation ID provided in the URL. Please provide a conversation ID to view details.');
    }
    return conversationId;
}

async function fetchConversationDetails(conversationId) {
    try {
        const conversationDetails = await callApi(conversationsApi.getAnalyticsConversationDetails.bind(conversationsApi), [conversationId]);
        return conversationDetails;
    } catch (error) {
        console.error(`GC Interaction Viewer - Failed to fetch conversation details:`, error);
        displayErrorMessage('Failed to fetch conversation details. Please check the console for details.');
        throw new Error('Failed to fetch conversation details: ' + error.message);
    }
}

async function fetchExternalContactSessions(contactId) {
    let opts = {
        "includeMerged": true
    };
    try {
        const sessionsData = await callApi(journeyApi.getExternalcontactsContactJourneySessions.bind(journeyApi), [contactId, opts]);
        return sessionsData;
    } catch (error) {
        console.error(`GC Interaction Viewer - Failed to fetch external contact sessions:`, error);
        displayErrorMessage('Failed to fetch contact sessions. Please check the console for details.');
        throw new Error('Failed to fetch external contact sessions: ' + error.message);
    }
}

async function fetchTranscriptUrl(conversationId, communicationId) {
    try {
        const transcriptUrlData = await callApi(speechTextAnalyticsApi.getSpeechandtextanalyticsConversationCommunicationTranscripturl.bind(speechTextAnalyticsApi), [conversationId, communicationId]);
        return transcriptUrlData;
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        console.error(`GC Interaction Viewer - Failed to fetch transcript URL:`, error);
        displayErrorMessage('Failed to fetch transcript URL. Please check the console for details.');
        throw new Error('Failed to fetch transcript URL: ' + error.message);
    }
}

async function fetchTranscriptData(transcriptUrl) {
    try {
        const response = await fetch(`/api/downloadTranscript?uri=${encodeURIComponent(transcriptUrl.url)}`, {
            headers: {
                'Authorization': `Bearer ${platformClient.ApiClient.instance.authData.accessToken}`
            }
        });
        if (!response.ok) {
            console.error(`GC Interaction Viewer - Failed to fetch transcript data, status:`, response.status);
            throw new Error(`Failed to fetch transcript data: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`GC Interaction Viewer - Error fetching transcript data:`, error);
        displayErrorMessage('Error fetching transcript data. Please check the console for details.');
        throw new Error('Error fetching transcript data: ' + error.message);
    }
}


async function fetchConversationSummary(conversationId) {
    try {
        const summaryData = await callApi(conversationsApi.getConversationSummaries.bind(conversationsApi), [conversationId]);
        return summaryData;
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        console.error(`GC Interaction Viewer - Failed to fetch conversation summary:`, error);
        displayErrorMessage('Failed to fetch conversation summary. Please check the console for details.');
        throw new Error('Failed to fetch conversation summary: ' + error.message);
    }
}

async function fetchConversationAnalytics(conversationId) {
    try {
        const analyticsData = await callApi(speechTextAnalyticsApi.getSpeechandtextanalyticsConversation.bind(speechTextAnalyticsApi), [conversationId]);
        return analyticsData;
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        console.error(`GC Interaction Viewer - Failed to fetch conversation analytics:`, error);
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
    let hasTranscriptContent = false;

    transcriptJson.transcripts.forEach(transcript => {
        if (transcript.phrases && transcript.phrases.length > 0) {
            hasTranscriptContent = true;
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

    if (!hasTranscriptContent) {
        return "<p>No transcript available.</p>";
    }

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
        const sentimentScorePercentage = (typeof analyticsData.sentimentScore === 'number' && !isNaN(analyticsData.sentimentScore)) ? (analyticsData.sentimentScore * 100).toFixed(2) + '%' : 'N/A';
        const sentimentTrendPercentage = analyticsData.sentimentTrendClass === 'NotCalculated' ? 'N/A' : (typeof analyticsData.sentimentTrend === 'number' && !isNaN(analyticsData.sentimentTrend)) ? (analyticsData.sentimentTrend * 100).toFixed(2) + '%' : 'N/A';

        analyticsHTML += `
            <div class="analytics-item"><strong>Sentiment Score:</strong> ${sentimentScorePercentage}</div>
            <div class="analytics-item"><strong>Sentiment Trend:</strong> ${sentimentTrendPercentage}</div>
        `;

        if (Array.isArray(analyticsData.empathyScores) && analyticsData.empathyScores.length > 0) {
            analyticsData.empathyScores.forEach(empathyScore => {
                const empathyScoreValue = (typeof empathyScore.score === 'number' && !isNaN(empathyScore.score)) ? empathyScore.score.toFixed(0) + '%' : 'N/A';
                 analyticsHTML += `<div class="analytics-item"><strong>Empathy Score:</strong> ${empathyScoreValue}</div>`;
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

        if (eventName === "com.genesys.analytics.detailevents.FlowStartEvent" || eventName === "com.genesys.analytics.detailevents.AcdStartEvent" || eventName === "com.genesys.analytics.detailevents.FlowEndEvent") {
            return 'unattended';
        } else if (eventName === "com.genesys.analytics.detailevents.AcdEndEvent" || eventName === "com.genesys.analytics.detailevents.AfterCallWorkEvent") {
            return 'attended';
        } else {
            return 'other';
        }
    }
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

        if (!sessions || sessions.length === 0) {
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

                // Prevent current tab navigation
                const conversationIdLink = sessionItem.querySelector('.conversation-id-link');
                conversationIdLink.addEventListener('click', (event) => {
                    event.preventDefault(); // Prevent default navigation in current tab
                    window.open(conversationIdLink.href, '_blank'); // Still open in new tab
                });


                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('session-details');

                const transcriptionSection = document.createElement('div');
                transcriptionSection.classList.add('detail-section');
                const transcriptionButton = document.createElement('button');
                transcriptionButton.classList.add('section-header-button');
                transcriptionButton.innerHTML = '📄 Transcription <span class="expand-icon">▼</span><span class="collapse-icon">▲</span>';
                const transcriptionContent = document.createElement('div');
                transcriptionContent.classList.add('section-content');
                transcriptionContent.style.display = 'none';
                transcriptionSection.appendChild(transcriptionButton);
                transcriptionSection.appendChild(transcriptionContent);
                detailsDiv.appendChild(transcriptionSection);

                transcriptionButton.addEventListener('click', async () => {
                    transcriptionSection.classList.toggle('expanded');
                    transcriptionContent.style.display = transcriptionSection.classList.contains('expanded') ? 'block' : 'none';
                    if (transcriptionSection.classList.contains('expanded') && !transcriptionSection.dataset.transcriptLoaded) {
                        transcriptionSection.dataset.transcriptLoaded = 'true';
                        displayLoading(transcriptionContent);
                        transcriptionContent.innerHTML = '<p>Loading Transcription...</p>';

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
                                    transcriptionContent.innerHTML = transcriptHTML;
                                } else {
                                    transcriptionContent.innerHTML = '<p>No transcriptions available for this conversation.</p>';
                                }
                            } else {
                                transcriptionContent.innerHTML = '<p>Customer session ID not found, cannot load transcript.</p>';
                            }

                        } catch (error) {
                            transcriptionContent.innerHTML = `<div class="error-message-inline">⚠ Error loading transcription: ${error.message}</div>`;
                        }
                    }
                });


                const summarySection = document.createElement('div');
                summarySection.classList.add('detail-section');
                const summaryButton = document.createElement('button');
                summaryButton.classList.add('section-header-button');
                summaryButton.innerHTML = 'Summary <span class="expand-icon">▼</span><span class="collapse-icon">▲</span>';
                const summaryContent = document.createElement('div');
                summaryContent.classList.add('section-content');
                summaryContent.style.display = 'none';
                summarySection.appendChild(summaryButton);
                summarySection.appendChild(summaryContent);
                detailsDiv.appendChild(summarySection);

                summaryButton.addEventListener('click', async () => {
                    summarySection.classList.toggle('expanded');
                    summaryContent.style.display = summarySection.classList.contains('expanded') ? 'block' : 'none';
                    if (summarySection.classList.contains('expanded') && !summarySection.dataset.summaryLoaded) {
                        summarySection.dataset.summaryLoaded = 'true';
                        displayLoading(summaryContent);
                        summaryContent.innerHTML = '<p>Loading Summary...</p>';

                        try {
                            const summaryData = await fetchConversationSummary(session.id);
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
                            } else {
                                summaryContent.innerHTML = '<p>No summaries available for this conversation.</p>';
                            }
                        } catch (error) {
                            summaryContent.innerHTML = `<div class="error-message-inline">⚠ Error loading summary: ${error.message}</div>`;
                        }
                    }
                });


                const analyticsSection = document.createElement('div');
                analyticsSection.classList.add('detail-section');
                const analyticsButton = document.createElement('button');
                analyticsButton.classList.add('section-header-button');
                analyticsButton.innerHTML = 'Analytics <span class="expand-icon">▼</span><span class="collapse-icon">▲</span>';
                const analyticsContent = document.createElement('div');
                analyticsContent.classList.add('section-content');
                analyticsContent.style.display = 'none';
                analyticsSection.appendChild(analyticsButton);
                analyticsSection.appendChild(analyticsContent);
                detailsDiv.appendChild(analyticsSection);


                analyticsButton.addEventListener('click', async () => {
                    analyticsSection.classList.toggle('expanded');
                    analyticsContent.style.display = analyticsSection.classList.contains('expanded') ? 'block' : 'none';
                    if (analyticsSection.classList.contains('expanded') && !analyticsSection.dataset.analyticsLoaded) {
                        analyticsSection.dataset.analyticsLoaded = 'true';
                        displayLoading(analyticsContent);
                        analyticsContent.innerHTML = '<p>Loading Analytics...</p>';
                        try {
                            const analyticsData = await fetchConversationAnalytics(session.id);
                            if (analyticsData) {
                                const analyticsDisplayHTML = displayConversationAnalytics(analyticsData);
                                analyticsContent.innerHTML = `<div class="analytics-grid">${analyticsDisplayHTML}</div>`;
                            } else {
                                analyticsContent.innerHTML = '<p>No analytics data available for this conversation.</p>';
                            }
                        } catch (error) {
                            analyticsContent.innerHTML = `<div class="error-message-inline">⚠ Error loading analytics: ${error.message}</div>`;
                        }
                    }
                });


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
            externalContactId = customerParticipant?.participantId;
        }


        const sessionsData = await fetchExternalContactSessions(externalContactId);
         allSessions = sessionsData.entities;


        relevantSessions = allSessions.filter(session => {
            if (!session.conversationChannels || session.conversationChannels.length === 0) {
                return false;
            }
            const mediaType = session.conversationChannels[0].type;
            return ['Voice', 'Message', 'Email'].includes(mediaType);
        });


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
        console.error(`GC Interaction Viewer - Initialization failed:`, error);
        displayErrorMessage('Failed to initialize application. Please check the console for details.');
    }
}


document.addEventListener('DOMContentLoaded', initialize);
