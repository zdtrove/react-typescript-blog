import { Request, Response } from 'express'
import Users from '../models/userModel'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { generateActiveToken, generateAccessToken, generaterRefreshToken } from '../config/generateToken'
import sendMail from '../config/sendMail'
import { validateEmail, validPhone } from '../middleware/valid'
import { sendSms } from '../config/sendSms'
import { IDecodedToken, IUser } from '../config/interface'

const CLIENT_URL = `${process.env.BASE_URL}`

const authCtrl = {
	register: async (req: Request, res: Response) => {
		try {
			const { name, account, password } = req.body
			const user = await Users.findOne({ account })
			if (user) return res.status(400).json({ msg: 'Email or Phone number already exists' })

			const passwordHash = await bcrypt.hash(password, 12)
			const newUser = {
				name, account, password: passwordHash
			}

			const activeToken = generateActiveToken({ newUser })
			const url = `${CLIENT_URL}/active/${activeToken}`

			if (validateEmail(account)) {
				sendMail(account, url, 'Verify your email address')
				return res.json({ msg: "Success! Please check your email"})
			} else if (validPhone(account)) {
				sendSms(account, url, "Verify your phone number")
				return res.json({ msg: "Success! Please check your phone"})
			}
		} catch (err) {
			return res.status(500).json({ msg: err.message })
		}
	},
	activeAccount: async (req: Request, res: Response) => {
		try {
			const { activeToken } = req.body
			const decoded = <IDecodedToken>jwt.verify(activeToken, `${process.env.ACTIVE_TOKEN_SECRET}`)
			const { newUser } = decoded

			if (!newUser) return res.status(400).json({ msg: "Invalid authentication" })

			const user = new Users(newUser)
			await user.save()

			return res.json({ msg: "Account has been activated" })
		} catch (err) {
			let errMsg
			if (err.code === 11000) {
				errMsg = Object.keys(err.keyValue)[0] + " already exists"
			} else {
				let name = Object.keys(err.errors)[0]
				errMsg = err.errors[`${name}`].message
			}
			return res.status(500).json({ msg: errMsg })
		}
	},
	login: async (req: Request, res: Response) => {
		try {
			const { account, password } = req.body
			const user = await Users.findOne({ account })
			if (!user) return res.status(400).json({ msg: 'This account does not exist'})
			
			loginUser(user, password, res)
		} catch (err) {
			return res.status(500).json({ msg: err.message })
		}
	},
	logout: async (req: Request, res: Response) => {
		try {
			res.clearCookie('refresh_token', { path: `/api/refresh_token`})
			return res.json({ msg: "Logged out" })
		} catch (err) {
			return res.status(500).json({ msg: err.message })
		}
	},
	refreshToken: async (req: Request, res: Response) => {
		try {
			const rf_token = req.cookies.refresh_token
			if (!rf_token) return res.status(400).json({ mgs: "Please login now" })

			const decoded = <IDecodedToken>jwt.verify(rf_token, `${process.env.REFRESH_TOKEN_SECRET}`)
			if (!decoded.id) return res.status(400).json({ msg: "Please login now" })

			const user = await Users.findById(decoded.id).select("-password")
			if (!user) return res.status(400).json({ msg: "This account does not exist" })

			const accessToken = generateAccessToken({ id: user._id })
			res.json({ accessToken })
		} catch (err) {
			return res.status(500).json({ msg: err.message })
		}
	},
}

const loginUser = async (user: IUser, password: string, res: Response) => {
	const isMatch = await bcrypt.compare(password, user.password)
	if (!isMatch) return res.status(500).json({ msg: "Password is incorrect" })
	const accessToken = generateAccessToken({ id: user._id })
	const  refreshToken = generaterRefreshToken({ id: user._id })
	res.cookie('refresh_token', refreshToken, {
		httpOnly: true,
		path: `/api/refresh_token`,
		maxAge: 30*24*60*60*1000 // 30days
	})

	res.json({
		msg: "Login success",
		accessToken,
		user: {...user._doc, password: ''}
	})
}

export default authCtrl