use crate::pb::sf::substreams::sink::entity::v1::{
    value::Typed, EntityChange, EntityChanges, Field, Operation, Value,
};

pub fn string(value: impl Into<String>) -> Value {
    Value {
        typed: Some(Typed::String(value.into())),
    }
}

pub fn bigint(value: impl Into<String>) -> Value {
    Value {
        typed: Some(Typed::Bigint(value.into())),
    }
}

pub fn bigdecimal(value: impl Into<String>) -> Value {
    Value {
        typed: Some(Typed::Bigdecimal(value.into())),
    }
}

pub fn int32(value: i32) -> Value {
    Value {
        typed: Some(Typed::Int32(value)),
    }
}

pub fn bytes(value: &[u8]) -> Value {
    Value {
        typed: Some(Typed::Bytes(base64::encode(value))),
    }
}

pub fn field(name: impl Into<String>, value: Value) -> Field {
    Field {
        name: name.into(),
        new_value: Some(value),
        old_value: None,
    }
}

pub fn change(
    entity: impl Into<String>,
    id: impl Into<String>,
    operation: Operation,
    fields: Vec<Field>,
) -> EntityChange {
    EntityChange {
        entity: entity.into(),
        id: id.into(),
        ordinal: 0,
        operation: operation as i32,
        fields,
    }
}

pub fn output(changes: Vec<EntityChange>) -> EntityChanges {
    EntityChanges {
        entity_changes: changes,
    }
}
