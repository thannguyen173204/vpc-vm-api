class DatabaseService {
    create = async (model, data) => {
        return model.create(data);
    }
    find = async (model, filter) => {
        return model.findOne(filter);
    }
    findMany = async (model, filter) => {
        return model.find(filter);
    }
    findById = async (model, id) => {
        return model.findById(id);
    }
    update = async (model, filter, data) => {
        return model.updateOne(filter, { $set: data })
    }
    updateById = async (model, id, data) => {
        return model.findByIdAndUpdate(id, data, { returnDocument: 'after' });
    }
    delete = async (model, data) => {
        return model.deleteOne(data);
    }
    deleteById = async (model, id) => {
        return model.findByIdAndDelete(id);
    }
}

export default new DatabaseService();