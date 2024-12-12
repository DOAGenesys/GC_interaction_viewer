module.exports = async (req, res) => {
    try {
        const { datetime } = req.query;
        
        const response = await fetch(
            `${process.env.AWS_API_ENDPOINT}/active-vet?datetime=${datetime}`,
            {
                headers: {
                    'X-Api-Key': process.env.AWS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch active vet' });
    }
};
