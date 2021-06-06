import mongoose from 'mongoose'
import { IUser } from '../config/interface'

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, "Please add your name"],
		trim: true,
		maxLength: [20, "Your name is up to 20 chars long"]
	},
	account: {
		type: String,
		required: [true, "Please add your email or phone"],
		trim: true,
		unique: true
	},
	password: {
		type: String,
		required: [true, "Please add your Password"]
	},
	avatar: {
		type: String,
		default: 'https://res.cloudinary.com/dj7zmqrth/image/upload/v1621141604/test/lb4xpsqhezdgtg9o2flp.png'
	},
	role: {
		type: String,
		default: 'user' // admin
	},
	type: {
		type: String,
		default: 'register' // login
	}
}, {
	timestamps: true
})

export default mongoose.model<IUser>('User', userSchema)