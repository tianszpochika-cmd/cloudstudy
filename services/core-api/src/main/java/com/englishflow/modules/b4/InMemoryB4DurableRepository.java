package com.englishflow.modules.b4;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(prefix = "englishflow.b4", name = "persistence", havingValue = "memory", matchIfMissing = true)
public final class InMemoryB4DurableRepository implements B4DurableRepository {
    private final List<Fact> facts = new CopyOnWriteArrayList<>();

    @Override
    public void append(Fact fact) { facts.add(fact); }

    @Override
    public List<Fact> list(String aggregateType, long userId) {
        return new ArrayList<>(facts.stream()
                .filter(fact -> aggregateType.equals(fact.aggregateType()) && fact.userId() == userId)
                .toList());
    }

    @Override
    public List<Fact> listAll(String aggregateType) {
        return new ArrayList<>(facts.stream()
                .filter(fact -> aggregateType.equals(fact.aggregateType()))
                .toList());
    }

    @Override
    public List<Fact> listByAggregate(String aggregateType, String aggregateId) {
        return new ArrayList<>(facts.stream()
                .filter(fact -> aggregateType.equals(fact.aggregateType())
                        && aggregateId.equals(fact.aggregateId()))
                .toList());
    }
}
