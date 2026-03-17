import mongoose from 'mongoose';

const vmSchema = new mongoose.Schema({
    user_id: {
        type: String,
        ref: 'User',
        required: true
    },

    vm_name: {
        type: String,
        required: true,
        unique: true
    },

    vm_username: {
        type: String,
        required: true
    },

    cpu: {
        type: Number,
        default: 1
    },

    ram: {
        type: Number,
        default: 1024
    },

    disk: {
        type: Number,
        required: true,
        default: 10
    },

    ip_address: {
        type: String,
        default: null
    },

    status: {
        type: String,
        enum: [
            'creating',
            'running',
            'pending',
            'stopped',
            'failed'
        ],
        default: 'creating'
    },

    step: {
        type: String,
        enum: [
            'init',
            'create_datastore',
            'clone_disk',
            'upload_vmx',
            'register_vm',
            'power_on',
            'wait_ip',
            'configure_guest',
            'completed'
        ],
        default: 'init'
    },

    error: {
        type: String,
        default: null
    }

}, { timestamps: true });

const Vm = mongoose.model('Vm', vmSchema);

export default Vm;