const EqubGroup = require('../models/equb');
const User = require('../models/user');


//tested
exports.createEqubGroupByAdmin = async (req, res) => {
  try {
    const { name, totalAmount, contributionPerUser, startDate, rounds, frequency } = req.body;
    // const adminId = req.user._id;

    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ message: 'Only admins can create Equb groups' });
    // }

    if (!name || !totalAmount || !contributionPerUser || !startDate || !rounds || !frequency) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Calculate end date based on frequency and rounds
    const frequencyMapping = {
      daily: 1,
      weekly: 7,
      monthly: 30,
    };

    const intervalDays = frequencyMapping[frequency];
    if (!intervalDays) {
      return res.status(400).json({ message: 'Invalid frequency provided' });
    }

    const calculatedEndDate = new Date(startDate);
    calculatedEndDate.setDate(calculatedEndDate.getDate() + rounds * intervalDays);

    const equbGroup = new EqubGroup({
      name,
      // createdBy: adminId,
      totalAmount,
      contributionPerUser,
      startDate,
      rounds,
      frequency,
      endDate: calculatedEndDate,
      status: 'active',
      participants: [],
    });

    await equbGroup.save();

    res.status(201).json({ message: 'Equb group created successfully', equbGroup });
  } catch (error) {
    res.status(500).json({ message: 'Error creating Equb group', error });
  }
};


exports.joinEqubGroup = async (req, res) => {
  try {
    const { groupId } = req.params;  
    const userId = req.user._id;  
    if (!groupId) {
      return res.status(400).json({ message: 'Group ID is required' });
    }

     const equbGroup = await EqubGroup.findById(groupId);

    if (!equbGroup) {
      return res.status(404).json({ message: 'Equb group not found' });
    }

    if (equbGroup.status !== 'active') {
      return res.status(400).json({ message: 'This Equb group is no longer active' });
    }

     const isAlreadyParticipant = equbGroup.participants.some(
      (participant) => participant.userId.toString() === userId.toString()
    );

    if (isAlreadyParticipant) {
      return res.status(400).json({ message: 'You are already a participant in this group' });
    }

     equbGroup.participants.push({
      userId,
      hasReceivedPayout: false,
      contributedAmount: 0,
      joinDate: new Date(),
    });

     await equbGroup.save();

    res.status(200).json({ message: 'Successfully joined the Equb group', equbGroup });
  } catch (error) {
    console.error('Error joining Equb group:', error);
    res.status(500).json({ message: 'Error joining Equb group', error });
  }
};

//tested
exports.getEqubGroupById = async (req, res) => {
    try {
      const { id } = req.params;
  
       const equbGroup = await EqubGroup.findById(id);
  
      if (!equbGroup) {
        return res.status(404).json({ message: 'Equb group not found' });
      }
  
      res.status(200).json({
        success: true,
        data: equbGroup,
      });
    } catch (error) {
      console.error('Error fetching Equb group:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
};


//tested
exports.getAllEqubGroups = async (req, res) => {
  try {
     const equbGroups = await EqubGroup.find();

    res.status(200).json({
      success: true,
      count: equbGroups.length,
      data: equbGroups,
    });
  } catch (error) {
    console.error('Error fetching Equb groups:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.processEqubPayments = async () => {
  try {
    const today = new Date();

    // Fetch Equb groups with due payouts
    const dueEqubGroups = await EqubGroup.find({
      status: 'active',
      nextPayoutDate: { $lte: today },
    });

    for (const equbGroup of dueEqubGroups) {
      // Find participants who haven't received a payout
      const eligibleParticipants = equbGroup.participants.filter(
        (participant) => !participant.hasReceivedPayout
      );

      if (eligibleParticipants.length === 0) {
        // Reset round if all participants have received payouts
        equbGroup.participants.forEach((participant) => {
          participant.hasReceivedPayout = false;
        });
        equbGroup.nextPayoutDate = calculateNextPayoutDate(today, equbGroup.type);
        await equbGroup.save();
        console.log(`Equb group "${equbGroup.name}" reset for a new round.`);
        continue;
      }

      const randomIndex = Math.floor(Math.random() * eligibleParticipants.length);
      const selectedParticipant = eligibleParticipants[randomIndex];

       equbGroup.participants = equbGroup.participants.map((participant) => {
        if (participant.userId.toString() === selectedParticipant.userId.toString()) {
          participant.hasReceivedPayout = true;
        }
        return participant;
      });

      equbGroup.nextPayoutDate = calculateNextPayoutDate(today, equbGroup.type);

      await equbGroup.save();

      console.log(`Payment given to user ${selectedParticipant.userId} in group "${equbGroup.name}".`);
    }
  } catch (error) {
    console.error('Error processing Equb payments:', error);
  }
};


exports.processEqubPaymentsHandler = async (req, res) => {
  try {
    await processEqubPayments();
    res.status(200).json({ message: 'Payments processed successfully' });
  } catch (error) {
    console.error('Error in processEqubPaymentsHandler:', error);
    res.status(500).json({ message: 'Error processing Equb payments', error });
  }
};