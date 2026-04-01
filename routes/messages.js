let express = require('express');
let router = express.Router()
let mongoose = require('mongoose')
const { CheckLogin } = require('../utils/authHandler')
const { uploadAnyFile } = require('../utils/uploadHandler')
let messageModel = require('../schemas/messages')
let userModel = require('../schemas/users')

router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let userID = req.params.userID;
        let currentUserID = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userID)) {
            res.status(404).send({
                message: 'userID khong hop le'
            })
            return;
        }

        let checkUser = await userModel.findOne({
            _id: userID,
            isDeleted: false
        })

        if (!checkUser) {
            res.status(404).send({
                message: 'userID khong ton tai'
            })
            return;
        }

        let result = await messageModel.find({
            $or: [
                {
                    from: currentUserID,
                    to: userID
                },
                {
                    from: userID,
                    to: currentUserID
                }
            ]
        }).sort({ createdAt: 1 })
            .populate({
                path: 'from',
                select: 'username email fullName avatarUrl'
            })
            .populate({
                path: 'to',
                select: 'username email fullName avatarUrl'
            })

        res.send(result)
    } catch (error) {
        res.status(404).send({
            message: error.message
        })
    }
})

router.post('/', CheckLogin, uploadAnyFile.single('file'), async function (req, res, next) {
    try {
        let currentUserID = req.user._id;
        let to = req.body.to;

        if (!to || !mongoose.Types.ObjectId.isValid(to)) {
            res.status(404).send({
                message: 'to khong hop le'
            })
            return;
        }

        let checkUser = await userModel.findOne({
            _id: to,
            isDeleted: false
        })

        if (!checkUser) {
            res.status(404).send({
                message: 'user nhan khong ton tai'
            })
            return;
        }

        let messageContent = null;
        if (req.file) {
            messageContent = {
                type: 'file',
                text: req.file.path
            }
        } else {
            let text = req.body.text;
            if (!text || text.trim().length === 0) {
                res.status(404).send({
                    message: 'text khong duoc de trong'
                })
                return;
            }
            messageContent = {
                type: 'text',
                text: text.trim()
            }
        }

        let newMessage = new messageModel({
            from: currentUserID,
            to: to,
            messageContent: messageContent
        })

        await newMessage.save();
        await newMessage.populate({
            path: 'from',
            select: 'username email fullName avatarUrl'
        })
        await newMessage.populate({
            path: 'to',
            select: 'username email fullName avatarUrl'
        })

        res.send(newMessage)
    } catch (error) {
        res.status(404).send({
            message: error.message
        })
    }
})

router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUserID = req.user._id;
        let allMessages = await messageModel.find({
            $or: [
                {
                    from: currentUserID
                },
                {
                    to: currentUserID
                }
            ]
        }).sort({ createdAt: -1 })
            .populate({
                path: 'from',
                select: 'username email fullName avatarUrl'
            })
            .populate({
                path: 'to',
                select: 'username email fullName avatarUrl'
            })

        let latestMap = new Map();
        for (const message of allMessages) {
            let fromID = message.from._id.toString();
            let toID = message.to._id.toString();
            let partnerID = fromID === currentUserID.toString() ? toID : fromID;

            if (!latestMap.has(partnerID)) {
                latestMap.set(partnerID, message)
            }
        }

        res.send(Array.from(latestMap.values()))
    } catch (error) {
        res.status(404).send({
            message: error.message
        })
    }
})

module.exports = router