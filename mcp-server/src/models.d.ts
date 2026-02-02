import mongoose from 'mongoose';
export declare const Stock: mongoose.Model<{
    itemName: string;
    quantity: number;
    unit: string;
    location: "shop" | "godown" | "factory";
    lastUpdated: NativeDate;
}, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    itemName: string;
    quantity: number;
    unit: string;
    location: "shop" | "godown" | "factory";
    lastUpdated: NativeDate;
}, {
    id: string;
}, mongoose.DefaultSchemaOptions> & Omit<{
    itemName: string;
    quantity: number;
    unit: string;
    location: "shop" | "godown" | "factory";
    lastUpdated: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    itemName: string;
    quantity: number;
    unit: string;
    location: "shop" | "godown" | "factory";
    lastUpdated: NativeDate;
}, mongoose.Document<unknown, {}, {
    itemName: string;
    quantity: number;
    unit: string;
    location: "shop" | "godown" | "factory";
    lastUpdated: NativeDate;
}, {
    id: string;
}, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & Omit<{
    itemName: string;
    quantity: number;
    unit: string;
    location: "shop" | "godown" | "factory";
    lastUpdated: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    [path: string]: mongoose.SchemaDefinitionProperty<undefined, any, any>;
} | {
    [x: string]: mongoose.SchemaDefinitionProperty<any, any, mongoose.Document<unknown, {}, {
        itemName: string;
        quantity: number;
        unit: string;
        location: "shop" | "godown" | "factory";
        lastUpdated: NativeDate;
    }, {
        id: string;
    }, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & Omit<{
        itemName: string;
        quantity: number;
        unit: string;
        location: "shop" | "godown" | "factory";
        lastUpdated: NativeDate;
    } & {
        _id: mongoose.Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, {
    itemName: string;
    quantity: number;
    unit: string;
    location: "shop" | "godown" | "factory";
    lastUpdated: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    itemName: string;
    quantity: number;
    unit: string;
    location: "shop" | "godown" | "factory";
    lastUpdated: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare const Order: mongoose.Model<{
    status: "pending" | "completed";
    items: mongoose.Types.DocumentArray<{
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }> & {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }>;
    createdAt: NativeDate;
    vendorName?: string | null;
}, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    status: "pending" | "completed";
    items: mongoose.Types.DocumentArray<{
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }> & {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }>;
    createdAt: NativeDate;
    vendorName?: string | null;
}, {
    id: string;
}, mongoose.DefaultSchemaOptions> & Omit<{
    status: "pending" | "completed";
    items: mongoose.Types.DocumentArray<{
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }> & {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }>;
    createdAt: NativeDate;
    vendorName?: string | null;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    status: "pending" | "completed";
    items: mongoose.Types.DocumentArray<{
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }> & {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }>;
    createdAt: NativeDate;
    vendorName?: string | null;
}, mongoose.Document<unknown, {}, {
    status: "pending" | "completed";
    items: mongoose.Types.DocumentArray<{
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }> & {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }>;
    createdAt: NativeDate;
    vendorName?: string | null;
}, {
    id: string;
}, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & Omit<{
    status: "pending" | "completed";
    items: mongoose.Types.DocumentArray<{
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }> & {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }>;
    createdAt: NativeDate;
    vendorName?: string | null;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    [path: string]: mongoose.SchemaDefinitionProperty<undefined, any, any>;
} | {
    [x: string]: mongoose.SchemaDefinitionProperty<any, any, mongoose.Document<unknown, {}, {
        status: "pending" | "completed";
        items: mongoose.Types.DocumentArray<{
            quantity?: number | null;
            productName?: string | null;
            price?: number | null;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            quantity?: number | null;
            productName?: string | null;
            price?: number | null;
        }> & {
            quantity?: number | null;
            productName?: string | null;
            price?: number | null;
        }>;
        createdAt: NativeDate;
        vendorName?: string | null;
    }, {
        id: string;
    }, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & Omit<{
        status: "pending" | "completed";
        items: mongoose.Types.DocumentArray<{
            quantity?: number | null;
            productName?: string | null;
            price?: number | null;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
            quantity?: number | null;
            productName?: string | null;
            price?: number | null;
        }> & {
            quantity?: number | null;
            productName?: string | null;
            price?: number | null;
        }>;
        createdAt: NativeDate;
        vendorName?: string | null;
    } & {
        _id: mongoose.Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, {
    status: "pending" | "completed";
    items: mongoose.Types.DocumentArray<{
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }> & {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }>;
    createdAt: NativeDate;
    vendorName?: string | null;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    status: "pending" | "completed";
    items: mongoose.Types.DocumentArray<{
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }> & {
        quantity?: number | null;
        productName?: string | null;
        price?: number | null;
    }>;
    createdAt: NativeDate;
    vendorName?: string | null;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=models.d.ts.map